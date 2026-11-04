import type {
  BidPrice,
  ExtremeCondition,
  RoomState,
  RoundResult,
  Team,
  TeamReflection,
} from '../types/game.ts';

const BROADCAST_NAME = 'civics_paper_room_sync';

export class LocalRoomEngine {
  private static channel: BroadcastChannel | null = null;
  private static listeners: Set<(room: RoomState) => void> = new Set();
  private static memoryStore: Map<string, RoomState> = new Map();

  public static init() {
    if (typeof window === 'undefined') return;
    if (!this.channel && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(BROADCAST_NAME);
        this.channel.onmessage = (event) => {
          if (event.data && event.data.type === 'SYNC_ROOM' && event.data.room) {
            this.memoryStore.set(event.data.room.roomId, event.data.room);
            this.notify(event.data.room);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported:', e);
      }
    }

    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('civics_room_state_') && e.newValue) {
        try {
          const room = JSON.parse(e.newValue) as RoomState;
          this.memoryStore.set(room.roomId, room);
          this.notify(room);
        } catch {}
      }
    });
  }

  public static subscribe(callback: (room: RoomState) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static notify(room: RoomState) {
    for (const listener of this.listeners) {
      listener(room);
    }
  }

  private static broadcast(room: RoomState) {
    this.memoryStore.set(room.roomId, room);
    this.notify(room);
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'SYNC_ROOM', room });
      } catch {}
    }
  }

  public static getRoom(roomId: string): RoomState | null {
    const cleanId = roomId.trim().toUpperCase();
    if (this.memoryStore.has(cleanId)) {
      return this.memoryStore.get(cleanId)!;
    }
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(`civics_room_state_${cleanId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as RoomState;
        this.memoryStore.set(cleanId, parsed);
        return parsed;
      } catch {}
    }
    return null;
  }

  public static saveRoom(room: RoomState) {
    this.memoryStore.set(room.roomId, room);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`civics_room_state_${room.roomId}`, JSON.stringify(room));
    }
    this.broadcast(room);
  }

  public static getOrCreateRoom(roomId: string, roomName = '公民課價格賽局'): RoomState {
    const cleanId = roomId.trim().toUpperCase();
    let room = this.getRoom(cleanId);
    if (!room) {
      room = {
        roomId: cleanId,
        roomName,
        status: 'LOBBY',
        currentRound: 1,
        totalRounds: 4,
        marketDemand: 1200,
        costPerUnit: 150,
        commRule: 'NO_COMM',
        negotiationSecondsRemaining: 90,
        isTimerRunning: false,
        teams: [],
        roundHistorySummary: [],
        lastRoundExtreme: null,
      };
      this.saveRoom(room);
    }
    return room;
  }

  public static joinTeam(
    roomId: string,
    teamInfo: { teamId?: string; teamNumber: number; name: string; members: string; brandTag: string }
  ): { team: Team; room: RoomState } {
    const room = this.getOrCreateRoom(roomId);
    let target = teamInfo.teamId ? room.teams.find((t) => t.id === teamInfo.teamId) : null;
    if (!target) {
      target = room.teams.find((t) => t.teamNumber === teamInfo.teamNumber);
    }

    if (target) {
      target.connected = true;
      if (teamInfo.brandTag) target.brandTag = teamInfo.brandTag;
      if (teamInfo.members && !target.members.includes(teamInfo.members)) {
        target.members = `${target.members}、${teamInfo.members}`;
      }
    } else {
      const colors = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0284c7', '#dc2626', '#16a34a'];
      const color = colors[(teamInfo.teamNumber - 1) % colors.length];
      target = {
        id: teamInfo.teamId || `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        teamNumber: teamInfo.teamNumber,
        name: teamInfo.name,
        members: teamInfo.members,
        brandTag: teamInfo.brandTag,
        color,
        connected: true,
        currentBid: null,
        currentAgreedPrice: null,
        hasSubmitted: false,
        totalProfit: 0,
        totalRevenue: 0,
        totalSoldUnits: 0,
        roundHistory: [],
        reflection: {
          r1r2Concern: '',
          r3r4Cheating: '',
          producerBenefit: '',
          consumerBenefit: '',
          governmentRole: '',
        },
      };
      room.teams.push(target);
      room.teams.sort((a, b) => a.teamNumber - b.teamNumber);
    }

    this.saveRoom(room);
    return { team: target, room };
  }

  public static submitBid(roomId: string, teamId: string, bid: BidPrice, agreedPrice?: number): RoomState {
    const room = this.getOrCreateRoom(roomId);
    const team = room.teams.find((t) => t.id === teamId);
    if (team) {
      team.currentBid = bid;
      team.hasSubmitted = true;
      if (agreedPrice !== undefined) team.currentAgreedPrice = agreedPrice;
    }

    const activeTeams = room.teams.filter((t) => t.connected || t.isAI);
    if (activeTeams.length > 0 && activeTeams.every((t) => t.hasSubmitted) && room.status === 'BIDDING') {
      setTimeout(() => {
        this.settleRound(roomId);
      }, 500);
    }

    this.saveRoom(room);
    return room;
  }

  public static submitReflection(roomId: string, teamId: string, reflection: TeamReflection): RoomState {
    const room = this.getOrCreateRoom(roomId);
    const team = room.teams.find((t) => t.id === teamId);
    if (team) {
      team.reflection = { ...team.reflection, ...reflection, submittedAt: Date.now() };
      this.saveRoom(room);
    }
    return room;
  }

  public static startRound(roomId: string, round: number): RoomState {
    const room = this.getOrCreateRoom(roomId);
    room.currentRound = round;
    room.status = 'BIDDING';
    room.commRule = round <= 2 ? 'NO_COMM' : 'OPEN_COMM';
    room.negotiationSecondsRemaining = round <= 2 ? 0 : 90;
    room.isTimerRunning = round > 2;
    room.lastRoundExtreme = null;

    for (const team of room.teams) {
      team.currentBid = null;
      team.currentAgreedPrice = null;
      team.hasSubmitted = false;
      if (team.isAI) {
        team.currentBid = (round <= 2 ? 400 : 450) as BidPrice;
        team.hasSubmitted = true;
      }
    }

    this.saveRoom(room);
    return room;
  }

  public static settleRound(roomId: string): RoomState {
    const room = this.getOrCreateRoom(roomId);
    const activeTeams = room.teams.filter((t) => t.connected || t.isAI);

    for (const team of activeTeams) {
      if (team.currentBid === null) {
        team.currentBid = 400 as BidPrice;
        team.hasSubmitted = true;
      }
    }

    const bids = activeTeams.map((t) => t.currentBid!);
    if (bids.length === 0) return room;

    const minBid = Math.min(...bids) as BidPrice;
    const winners = activeTeams.filter((t) => t.currentBid === minBid);
    const winnerCount = winners.length;
    const unitsPerWinner = Math.floor(room.marketDemand / winnerCount);
    const unitProfit = minBid - room.costPerUnit;
    const profitPerWinner = unitsPerWinner * unitProfit;

    const allBidsObj: Record<string, BidPrice> = {};
    for (const t of activeTeams) {
      allBidsObj[t.id] = t.currentBid!;
    }

    for (const team of room.teams) {
      const isWinner = team.currentBid === minBid;
      const unitsSold = isWinner ? unitsPerWinner : 0;
      const profit = isWinner ? profitPerWinner : 0;
      const revenue = unitsSold * (team.currentBid || 0);

      team.totalSoldUnits += unitsSold;
      team.totalProfit += profit;
      team.totalRevenue += revenue;

      const roundResult: RoundResult = {
        round: room.currentRound,
        commRule: room.commRule,
        bid: team.currentBid || (400 as BidPrice),
        agreedPrice: team.currentAgreedPrice,
        marketMinPrice: minBid,
        isWinner,
        unitsSold,
        revenue,
        profit,
        allBids: { ...allBidsObj },
      };
      team.roundHistory.push(roundResult);
    }

    const countRecord: Record<BidPrice, number> = { 450: 0, 400: 0, 200: 0 };
    bids.forEach((b) => {
      countRecord[b] = (countRecord[b] || 0) + 1;
    });

    const consumerScore = minBid === 200 ? 100 : minBid === 400 ? 55 : 15;

    let extreme: ExtremeCondition | null = null;
    if (minBid === 450 && winnerCount === activeTeams.length) {
      extreme = {
        type: 'ALL_450',
        title: '👑 全員 450 元！卡特爾暴利同盟達成',
        description: '所有廠商守信開出最高價！每家廠商坐享最高毛利，而全場消費者被迫承受最昂貴代價！',
        civicsInsight: '此即為經濟學中的「卡特爾 (Cartel) 壟斷協議」。在現實中，《公平交易法》嚴格禁止這種聯合哄抬定價行為！',
      };
    } else if (minBid === 200 && winnerCount === activeTeams.length) {
      extreme = {
        type: 'ALL_200',
        title: '🔥 全員 200 元！血流成河價格戰',
        description: '全員陷入不信任或割喉殺價！廠商利潤被壓縮至保本邊緣（每箱僅賺 $50），消費者成為最大贏家！',
        civicsInsight: '此為典型「囚徒困境的納許均衡 (Nash Equilibrium)」。即使大家都知道開 450 更好，但由於害怕對手降價，最終全體墜入低價泥淖。',
      };
    } else if (winnerCount === 1 && activeTeams.length > 1) {
      const winner = winners[0];
      extreme = {
        type: 'SOLO_BETRAYER',
        title: `⚡ 驚天大背叛！【${winner.brandTag}】獨吞全場！`,
        description: `其他組開出較高價格，唯獨 ${winner.brandTag} 狠心降價至 ${minBid} 元，一人獨攬全場 1200 箱所有訂單！`,
        civicsInsight: '背叛者獲得全場最大利潤！這正是寡占市場中協議難以維持的根本原因：個人的暴利誘惑破壞了集體合作。',
      };
    }
    room.lastRoundExtreme = extreme;

    room.roundHistorySummary.push({
      round: room.currentRound,
      commRule: room.commRule,
      minPrice: minBid,
      winnerTeamIds: winners.map((w) => w.id),
      bidsCount: countRecord,
      consumerSurplusScore: consumerScore,
    });

    room.status = 'ROUND_RESULT';
    this.saveRoom(room);
    return room;
  }

  public static nextPhase(roomId: string): RoomState {
    const room = this.getOrCreateRoom(roomId);
    if (room.status === 'ROUND_RESULT') {
      if (room.currentRound < room.totalRounds) {
        return this.startRound(roomId, room.currentRound + 1);
      } else {
        room.status = 'DISCUSSION';
        this.saveRoom(room);
        return room;
      }
    } else if (room.status === 'DISCUSSION') {
      room.status = 'GAME_OVER';
      this.saveRoom(room);
      return room;
    }
    return room;
  }

  public static addAI(roomId: string, count = 2): RoomState {
    const room = this.getOrCreateRoom(roomId);
    const presets = ['舒潔拉拉隊 (AI)', '五月花厚棒 (AI)', '春風柔情隊 (AI)', '科克蘭霸王 (AI)'];
    const colors = ['#2563eb', '#e11d48', '#059669', '#d97706'];

    for (let i = 0; i < count; i++) {
      const existingNums = new Set(room.teams.map((t) => t.teamNumber));
      let nextNum = 1;
      while (existingNums.has(nextNum)) nextNum++;

      const brand = presets[(nextNum - 1) % presets.length];
      const newTeam: Team = {
        id: `ai_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        teamNumber: nextNum,
        name: `第 ${nextNum} 組 (${brand})`,
        members: '電腦 AI 模擬',
        brandTag: brand,
        color: colors[(nextNum - 1) % colors.length],
        connected: true,
        isAI: true,
        currentBid: room.status === 'BIDDING' ? (450 as BidPrice) : null,
        currentAgreedPrice: null,
        hasSubmitted: room.status === 'BIDDING',
        totalProfit: 0,
        totalRevenue: 0,
        totalSoldUnits: 0,
        roundHistory: [],
        reflection: {
          r1r2Concern: '',
          r3r4Cheating: '',
          producerBenefit: '',
          consumerBenefit: '',
          governmentRole: '',
        },
      };
      room.teams.push(newTeam);
      room.teams.sort((a, b) => a.teamNumber - b.teamNumber);
    }

    this.saveRoom(room);
    return room;
  }

  public static reset(roomId: string): RoomState {
    const room = this.getOrCreateRoom(roomId);
    room.status = 'LOBBY';
    room.currentRound = 1;
    room.roundHistorySummary = [];
    room.lastRoundExtreme = null;

    for (const team of room.teams) {
      team.currentBid = null;
      team.currentAgreedPrice = null;
      team.hasSubmitted = false;
      team.totalProfit = 0;
      team.totalRevenue = 0;
      team.totalSoldUnits = 0;
      team.roundHistory = [];
    }

    this.saveRoom(room);
    return room;
  }

  public static kickTeam(roomId: string, teamId: string): RoomState {
    const room = this.getOrCreateRoom(roomId);
    room.teams = room.teams.filter((t) => t.id !== teamId);
    this.saveRoom(room);
    return room;
  }
}
