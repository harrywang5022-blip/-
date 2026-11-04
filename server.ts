import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  BidPrice,
  CommRule,
  ExtremeCondition,
  GameStatus,
  RoomState,
  RoundResult,
  Team,
  TeamReflection,
  WSClientMessage,
  WSServerMessage,
} from './src/types/game.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConnectedClient {
  ws: WebSocket;
  roomId?: string;
  role?: 'HOST' | 'TEAM';
  teamId?: string;
}

class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private clients: Map<WebSocket, ConnectedClient> = new Map();

  constructor() {}

  public registerClient(ws: WebSocket) {
    this.clients.set(ws, { ws });
  }

  public unregisterClient(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (client && client.roomId) {
      const room = this.rooms.get(client.roomId);
      if (room && client.teamId) {
        const team = room.teams.find((t) => t.id === client.teamId);
        if (team) {
          team.connected = false;
          this.broadcastRoomState(client.roomId);
        }
      }
    }
    this.clients.delete(ws);
  }

  public getOrCreateRoom(roomId: string, roomName = '公民課價格賽局'): RoomState {
    const cleanId = roomId.trim().toUpperCase();
    if (!this.rooms.has(cleanId)) {
      const newRoom: RoomState = {
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
      this.rooms.set(cleanId, newRoom);
    }
    return this.rooms.get(cleanId)!;
  }

  public handleJoinTeam(
    roomId: string,
    teamInfo: {
      teamId?: string;
      teamNumber: number;
      name?: string;
      members?: string;
      brandTag?: string;
    }
  ): Team {
    const room = this.getOrCreateRoom(roomId);
    
    // 1. If explicit teamId is provided, reconnect or update that exact team
    if (teamInfo.teamId) {
      const existingById = room.teams.find((t) => t.id === teamInfo.teamId);
      if (existingById) {
        existingById.connected = true;
        if (teamInfo.brandTag) existingById.brandTag = teamInfo.brandTag;
        if (teamInfo.members && !existingById.members.includes(teamInfo.members)) {
          existingById.members = `${existingById.members}、${teamInfo.members}`;
        }
        this.broadcastRoomState(room.roomId);
        return existingById;
      }
    }

    // 2. Check if a team with this teamNumber already exists in the room
    const existingByNum = room.teams.find((t) => t.teamNumber === teamInfo.teamNumber);
    if (existingByNum) {
      // Reconnect/attach to existing team (e.g. multiple devices in same group, or browser refresh)
      existingByNum.connected = true;
      if (teamInfo.brandTag) existingByNum.brandTag = teamInfo.brandTag;
      if (teamInfo.members && !existingByNum.members.includes(teamInfo.members)) {
        existingByNum.members = `${existingByNum.members}、${teamInfo.members}`;
      }
      this.broadcastRoomState(room.roomId);
      return existingByNum;
    }

    // 3. Create a brand new team
    const newTeamId =
      teamInfo.teamId || `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const brand = teamInfo.brandTag || `第 ${teamInfo.teamNumber} 組`;
    const newTeam: Team = {
      id: newTeamId,
      teamNumber: teamInfo.teamNumber,
      name: `第 ${teamInfo.teamNumber} 組 (${brand})`,
      members: teamInfo.members || `第 ${teamInfo.teamNumber} 組組員`,
      brandTag: brand,
      color: this.getTeamColor(teamInfo.teamNumber),
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

    room.teams.push(newTeam);
    room.teams.sort((a, b) => a.teamNumber - b.teamNumber);
    this.broadcastRoomState(room.roomId);
    return newTeam;
  }

  public handleStartRound(roomId: string, roundNum: number): RoomState {
    const room = this.getOrCreateRoom(roomId);
    room.currentRound = roundNum;
    room.status = 'BIDDING';
    room.commRule = roundNum <= 2 ? 'NO_COMM' : 'OPEN_COMM';
    room.negotiationSecondsRemaining = roundNum <= 2 ? 0 : 90;
    room.isTimerRunning = roundNum > 2;

    // Reset current bids
    for (const team of room.teams) {
      team.currentBid = null;
      team.hasSubmitted = false;
      team.currentAgreedPrice = null;

      // AI auto bidding logic if team is AI
      if (team.isAI) {
        this.generateAIBid(team, room);
      }
    }

    this.broadcastRoomState(room.roomId);

    if (room.isTimerRunning) {
      this.startNegotiationTimer(room.roomId);
    }
    return room;
  }

  public handleNextPhase(roomId: string): RoomState {
    const room = this.getOrCreateRoom(roomId);
    if (room.status === 'ROUND_RESULT') {
      if (room.currentRound < room.totalRounds) {
        return this.handleStartRound(roomId, room.currentRound + 1);
      } else {
        room.status = 'DISCUSSION';
        this.broadcastRoomState(room.roomId);
      }
    } else if (room.status === 'DISCUSSION') {
      room.status = 'GAME_OVER';
      this.broadcastRoomState(room.roomId);
    }
    return room;
  }

  public handleReset(roomId: string): RoomState {
    const room = this.getOrCreateRoom(roomId);
    this.stopNegotiationTimer(room.roomId);

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

    this.broadcastRoomState(room.roomId);
    return room;
  }

  public handleAddAI(roomId: string, count: number): RoomState {
    const room = this.getOrCreateRoom(roomId);
    const aiPresets: {
      brand: string;
      strategy: 'GREEDY_CHEATER' | 'HONEST_CARTEL' | 'PRICE_WARRIOR' | 'RANDOM';
    }[] = [
      { brand: '舒潔拉拉隊 (AI)', strategy: 'HONEST_CARTEL' },
      { brand: '五月花厚棒 (AI)', strategy: 'GREEDY_CHEATER' },
      { brand: '春風柔情隊 (AI)', strategy: 'PRICE_WARRIOR' },
      { brand: '科克蘭賣場霸主 (AI)', strategy: 'RANDOM' },
    ];

    for (let i = 0; i < count; i++) {
      const existingNumbers = new Set(room.teams.map((t) => t.teamNumber));
      let nextNum = 1;
      while (existingNumbers.has(nextNum)) nextNum++;

      const preset = aiPresets[(nextNum - 1) % aiPresets.length];
      const newTeam: Team = {
        id: `ai_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        teamNumber: nextNum,
        name: `第 ${nextNum} 組 (${preset.brand})`,
        members: '電腦 AI 模擬',
        brandTag: preset.brand,
        color: this.getTeamColor(nextNum),
        connected: true,
        isAI: true,
        aiStrategy: preset.strategy,
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

      if (room.status === 'BIDDING') {
        this.generateAIBid(newTeam, room);
      }

      room.teams.push(newTeam);
    }

    this.broadcastRoomState(room.roomId);
    return room;
  }

  public handleKickTeam(roomId: string, teamId: string): RoomState {
    const room = this.getOrCreateRoom(roomId);
    room.teams = room.teams.filter((t) => t.id !== teamId);
    this.broadcastRoomState(room.roomId);
    return room;
  }

  public handleTimer(roomId: string, action: 'start' | 'pause', seconds?: number): RoomState {
    const room = this.getOrCreateRoom(roomId);
    if (action === 'start') {
      if (typeof seconds === 'number') {
        room.negotiationSecondsRemaining = seconds;
      }
      room.isTimerRunning = true;
      this.startNegotiationTimer(room.roomId);
    } else {
      room.isTimerRunning = false;
      this.stopNegotiationTimer(room.roomId);
    }
    this.broadcastRoomState(room.roomId);
    return room;
  }

  public handleBid(roomId: string, teamId: string, bid: BidPrice, agreedPrice?: number) {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) return;
    const team = room.teams.find((t) => t.id === teamId);
    if (!team) return;

    team.currentBid = bid;
    team.hasSubmitted = true;
    if (agreedPrice !== undefined) {
      team.currentAgreedPrice = agreedPrice;
    }

    const activeTeams = room.teams.filter((t) => t.connected || t.isAI);
    const allSubmitted = activeTeams.length > 0 && activeTeams.every((t) => t.hasSubmitted);

    this.broadcastRoomState(room.roomId);

    if (allSubmitted && room.status === 'BIDDING') {
      setTimeout(() => {
        this.settleRound(room.roomId);
      }, 1000);
    }
  }

  public handleReflection(roomId: string, teamId: string, reflection: TeamReflection) {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) return;
    const team = room.teams.find((t) => t.id === teamId);
    if (!team) return;
    team.reflection = { ...reflection, submittedAt: Date.now() };
    this.broadcastRoomState(room.roomId);
  }

  public handleClientMessage(ws: WebSocket, msg: WSClientMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (msg.type) {
      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG' } satisfies WSServerMessage));
        break;

      case 'JOIN_HOST': {
        const room = this.getOrCreateRoom(msg.roomId);
        client.roomId = room.roomId;
        client.role = 'HOST';
        this.sendRoomState(ws, room.roomId);
        break;
      }

      case 'JOIN_TEAM': {
        const cleanRoom = msg.roomId.trim().toUpperCase();
        client.roomId = cleanRoom;
        client.role = 'TEAM';
        const team = this.handleJoinTeam(cleanRoom, msg.teamInfo);
        client.teamId = team.id;
        // Directly send room state with yourTeamId to this socket!
        this.sendRoomState(ws, cleanRoom, team.id);
        break;
      }

      case 'SUBMIT_BID': {
        this.handleBid(msg.roomId, msg.teamId, msg.bid, msg.agreedPrice);
        ws.send(JSON.stringify({ type: 'BID_ACCEPTED', teamId: msg.teamId } satisfies WSServerMessage));
        break;
      }

      case 'SUBMIT_REFLECTION': {
        this.handleReflection(msg.roomId, msg.teamId, msg.reflection);
        break;
      }


      case 'HOST_START_ROUND': {
        this.handleStartRound(msg.roomId, msg.round);
        break;
      }

      case 'HOST_FORCE_REVEAL': {
        this.settleRound(msg.roomId);
        break;
      }

      case 'HOST_NEXT_PHASE': {
        this.handleNextPhase(msg.roomId);
        break;
      }

      case 'HOST_START_TIMER': {
        const room = this.getOrCreateRoom(msg.roomId);
        room.negotiationSecondsRemaining = msg.seconds;
        room.isTimerRunning = true;
        this.startNegotiationTimer(room.roomId);
        this.broadcastRoomState(room.roomId);
        break;
      }

      case 'HOST_PAUSE_TIMER': {
        const room = this.getOrCreateRoom(msg.roomId);
        room.isTimerRunning = false;
        this.stopNegotiationTimer(room.roomId);
        this.broadcastRoomState(room.roomId);
        break;
      }

      case 'HOST_ADD_AI_TEAMS': {
        this.handleAddAI(msg.roomId, msg.count);
        break;
      }

      case 'HOST_RESET_GAME': {
        const room = this.rooms.get(msg.roomId);
        if (!room) return;
        this.stopNegotiationTimer(room.roomId);

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

        this.broadcastRoomState(room.roomId);
        break;
      }

      case 'HOST_KICK_TEAM': {
        const room = this.rooms.get(msg.roomId);
        if (!room) return;
        room.teams = room.teams.filter((t) => t.id !== msg.teamId);
        this.broadcastRoomState(room.roomId);
        break;
      }

      case 'HOST_SET_TEAM_BID': {
        const room = this.rooms.get(msg.roomId);
        if (!room) return;
        const team = room.teams.find((t) => t.id === msg.teamId);
        if (!team) return;
        team.currentBid = msg.bid;
        team.hasSubmitted = true;
        if (msg.agreedPrice !== undefined) {
          team.currentAgreedPrice = msg.agreedPrice;
        }

        // Check if all connected teams have submitted
        const activeTeams = room.teams.filter((t) => t.connected || t.isAI);
        const allSubmitted = activeTeams.length > 0 && activeTeams.every((t) => t.hasSubmitted);

        this.broadcastRoomState(room.roomId);

        if (allSubmitted && room.status === 'BIDDING') {
          setTimeout(() => {
            this.settleRound(room.roomId);
          }, 1000);
        }
        break;
      }

      case 'HOST_SET_ROOM_CONFIG': {
        const room = this.rooms.get(msg.roomId);
        if (!room) return;
        if (msg.marketDemand) room.marketDemand = msg.marketDemand;
        if (msg.costPerUnit) room.costPerUnit = msg.costPerUnit;
        this.broadcastRoomState(room.roomId);
        break;
      }
    }
  }

  private generateAIBid(team: Team, room: RoomState) {
    let bid: BidPrice = 450;
    const r = room.currentRound;

    if (team.aiStrategy === 'HONEST_CARTEL') {
      // Likes 450 in rounds 3 & 4 if negotiated
      bid = r <= 2 ? 400 : 450;
    } else if (team.aiStrategy === 'GREEDY_CHEATER') {
      // Negotiates 450, but betrays with 400 or 200
      bid = r <= 2 ? 200 : (Math.random() > 0.4 ? 400 : 200);
    } else if (team.aiStrategy === 'PRICE_WARRIOR') {
      // Aggressive price cutter
      bid = 200;
    } else {
      // Random
      const choices: BidPrice[] = [450, 400, 200];
      bid = choices[Math.floor(Math.random() * choices.length)];
    }

    team.currentBid = bid;
    team.hasSubmitted = true;
    if (r >= 3) {
      team.currentAgreedPrice = 450;
    }
  }

  public settleRound(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.stopNegotiationTimer(roomId);

    // Default missing bids to 450 if any active team didn't submit
    for (const team of room.teams) {
      if (!team.hasSubmitted || team.currentBid === null) {
        team.currentBid = 450;
        team.hasSubmitted = true;
      }
    }

    const bids = room.teams.map((t) => t.currentBid!);
    if (bids.length === 0) return;

    const minPrice = Math.min(...bids);
    const winners = room.teams.filter((t) => t.currentBid === minPrice);
    const losers = room.teams.filter((t) => t.currentBid !== minPrice);

    const unitsPerWinner = Math.floor(room.marketDemand / winners.length);
    const cost = room.costPerUnit;

    const allBidsRecord: Record<string, BidPrice> = {};
    room.teams.forEach((t) => {
      allBidsRecord[t.id] = t.currentBid!;
    });

    // Update winners
    for (const winner of winners) {
      const units = unitsPerWinner;
      const revenue = units * winner.currentBid!;
      const profit = units * (winner.currentBid! - cost);

      winner.totalSoldUnits += units;
      winner.totalRevenue += revenue;
      winner.totalProfit += profit;

      const roundResult: RoundResult = {
        round: room.currentRound,
        commRule: room.commRule,
        bid: winner.currentBid!,
        agreedPrice: winner.currentAgreedPrice,
        marketMinPrice: minPrice,
        isWinner: true,
        unitsSold: units,
        revenue,
        profit,
        allBids: { ...allBidsRecord },
      };
      winner.roundHistory.push(roundResult);
    }

    // Update losers
    for (const loser of losers) {
      const roundResult: RoundResult = {
        round: room.currentRound,
        commRule: room.commRule,
        bid: loser.currentBid!,
        agreedPrice: loser.currentAgreedPrice,
        marketMinPrice: minPrice,
        isWinner: false,
        unitsSold: 0,
        revenue: 0,
        profit: 0,
        allBids: { ...allBidsRecord },
      };
      loser.roundHistory.push(roundResult);
    }

    // Determine extreme condition
    const extreme = this.evaluateExtremeCondition(room, minPrice, winners.length, room.teams.length);
    room.lastRoundExtreme = extreme;

    // Count bids
    const countRecord: Record<BidPrice, number> = { 450: 0, 400: 0, 200: 0 };
    bids.forEach((b) => {
      countRecord[b] = (countRecord[b] || 0) + 1;
    });

    // Consumer surplus score: 200 = 100, 400 = 50, 450 = 10
    const consumerScore = minPrice === 200 ? 100 : minPrice === 400 ? 55 : 15;

    room.roundHistorySummary.push({
      round: room.currentRound,
      commRule: room.commRule,
      minPrice,
      winnerTeamIds: winners.map((w) => w.id),
      bidsCount: countRecord,
      consumerSurplusScore: consumerScore,
    });

    room.status = 'ROUND_RESULT';
    this.broadcastRoomState(roomId);
  }

  private evaluateExtremeCondition(
    room: RoomState,
    minPrice: number,
    winnerCount: number,
    totalTeams: number,
  ): ExtremeCondition {
    const isRound3or4 = room.currentRound >= 3;

    if (minPrice === 450 && winnerCount === totalTeams) {
      return {
        type: 'ALL_450',
        title: '👑 全員 450 元！卡特爾暴利同盟達成',
        description: '所有廠商守信開出最高價！每家廠商坐享最高毛利，而全場消費者被迫承受最昂貴代價！',
        civicsInsight: '此即為經濟學中的「卡特爾 (Cartel) 壟斷協議」。在現實中，《公平交易法》嚴格禁止這種聯合哄抬定價行為！',
      };
    }

    if (minPrice === 200 && winnerCount === totalTeams) {
      return {
        type: 'ALL_200',
        title: '🔥 全員 200 元！血流成河價格戰',
        description: '全員陷入不信任或割喉殺價！廠商利潤被壓縮至保本邊緣（每箱僅賺 $50），消費者成為最大贏家！',
        civicsInsight: '此為典型「囚徒困境的納許均衡 (Nash Equilibrium)」。即使大家都知道開 450 更好，但由於害怕對手降價，最終全體墜入低價泥淖。',
      };
    }

    if (winnerCount === 1 && totalTeams > 1) {
      const winner = room.teams.find((t) => t.currentBid === minPrice);
      return {
        type: 'SOLO_BETRAYER',
        title: `😈 刺客背叛！${winner?.brandTag || '獨家廠商'} 獨吞全場！`,
        description: `開出低價 ${minPrice} 元，一舉擊潰其他所有開高價的廠商，獨攬 ${room.marketDemand} 箱所有訂單！其餘廠商銷量掛零！`,
        civicsInsight: '在寡占市場中，只要一家廠商偷偷降價背叛協議，就能以小幅讓利掠奪整個市場。這正是協議定價極難維持的原因。',
      };
    }

    if (isRound3or4 && minPrice < 450) {
      return {
        type: 'CARTEL_BROKEN',
        title: '💔 盟約破裂！跨組協商遭撕毀',
        description: '雖然開放大家面對面討論協議，但在秘密報價的那一刻，仍有人經不住誘惑偷偷破壞協議！',
        civicsInsight: '缺乏強制執行力與法律約束的私下協議（黑市卡特爾），往往因為個別成員的投機誘因而在轉瞬之間土崩瓦解。',
      };
    }

    return {
      type: 'SPLIT_MARKET',
      title: `⚡ 最低價 ${minPrice} 元！${winnerCount} 家廠商平分市場`,
      description: `開出 ${minPrice} 元的 ${winnerCount} 家廠商瓜分市場，其餘開高價者本回合銷量為 0。`,
      civicsInsight: '在消費者只看價格的同質化市場（如衛生紙），哪怕只比別人貴 50 元，都會在瞬間喪失所有顧客！',
    };
  }

  private startNegotiationTimer(roomId: string) {
    this.stopNegotiationTimer(roomId);
    const room = this.rooms.get(roomId);
    if (!room) return;

    const timer = setInterval(() => {
      if (room.negotiationSecondsRemaining > 0 && room.isTimerRunning) {
        room.negotiationSecondsRemaining -= 1;
        this.broadcastToRoom(roomId, {
          type: 'TIMER_TICK',
          seconds: room.negotiationSecondsRemaining,
        });
      } else {
        this.stopNegotiationTimer(roomId);
        room.isTimerRunning = false;
        this.broadcastRoomState(roomId);
      }
    }, 1000);

    this.timers.set(roomId, timer);
  }

  private stopNegotiationTimer(roomId: string) {
    const timer = this.timers.get(roomId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(roomId);
    }
  }

  private getTeamColor(teamNumber: number): string {
    const colors = [
      '#2563eb', // blue
      '#dc2626', // red
      '#059669', // emerald
      '#d97706', // amber
      '#7c3aed', // purple
      '#0891b2', // cyan
      '#db2777', // pink
      '#4b5563', // gray
    ];
    return colors[(teamNumber - 1) % colors.length];
  }

  public broadcastRoomState(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const [ws, client] of this.clients.entries()) {
      if (client.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        this.sendRoomState(ws, roomId, client.teamId);
      }
    }
  }

  public broadcastToRoom(roomId: string, message: WSServerMessage) {
    for (const [ws, client] of this.clients.entries()) {
      if (client.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  }

  private sendRoomState(ws: WebSocket, roomId: string, forTeamId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Sanitize state: if in BIDDING phase, do NOT reveal other teams' currentBid!
    const sanitizedTeams = room.teams.map((t) => {
      if (room.status === 'BIDDING') {
        const isMyTeam = forTeamId && t.id === forTeamId;
        return {
          ...t,
          currentBid: isMyTeam ? t.currentBid : null,
          // hasSubmitted is visible so everyone knows who is ready
        };
      }
      return t;
    });

    const payload: WSServerMessage = {
      type: 'ROOM_STATE',
      state: {
        ...room,
        teams: sanitizedTeams,
      },
      yourTeamId: forTeamId,
    };

    ws.send(JSON.stringify(payload));
  }
}

async function startServer() {
  const app = express();
  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server });
  const roomManager = new RoomManager();

  wss.on('connection', (ws) => {
    roomManager.registerClient(ws);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WSClientMessage;
        roomManager.handleClientMessage(ws, msg);
      } catch (err) {
        console.error('Invalid message format:', err);
      }
    });

    ws.on('close', () => {
      roomManager.unregisterClient(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err);
      roomManager.unregisterClient(ws);
    });
  });

  app.use(express.json());

  // API endpoints
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/rooms/:roomId', (req, res) => {
    const room = roomManager.getOrCreateRoom(req.params.roomId);
    res.json(room);
  });

  app.post('/api/rooms/:roomId/join', (req, res) => {
    const { teamInfo } = req.body;
    if (!teamInfo) {
      return res.status(400).json({ error: 'teamInfo is required' });
    }
    const team = roomManager.handleJoinTeam(req.params.roomId, teamInfo);
    const room = roomManager.getOrCreateRoom(req.params.roomId);
    res.json({ team, room });
  });

  app.post('/api/rooms/:roomId/bid', (req, res) => {
    const { teamId, bid, agreedPrice } = req.body;
    if (!teamId || !bid) {
      return res.status(400).json({ error: 'teamId and bid are required' });
    }
    roomManager.handleBid(req.params.roomId, teamId, bid, agreedPrice);
    const room = roomManager.getOrCreateRoom(req.params.roomId);
    res.json({ ok: true, room });
  });

  app.post('/api/rooms/:roomId/reflection', (req, res) => {
    const { teamId, reflection } = req.body;
    if (!teamId || !reflection) {
      return res.status(400).json({ error: 'teamId and reflection are required' });
    }
    roomManager.handleReflection(req.params.roomId, teamId, reflection);
    const room = roomManager.getOrCreateRoom(req.params.roomId);
    res.json({ ok: true, room });
  });

  // Host action REST endpoints with guaranteed state synchronization
  app.post('/api/rooms/:roomId/start-round', (req, res) => {
    const round = Number(req.body.round) || 1;
    const room = roomManager.handleStartRound(req.params.roomId, round);
    res.json({ ok: true, room });
  });

  app.post('/api/rooms/:roomId/force-reveal', (req, res) => {
    roomManager.settleRound(req.params.roomId);
    const room = roomManager.getOrCreateRoom(req.params.roomId);
    res.json({ ok: true, room });
  });

  app.post('/api/rooms/:roomId/next-phase', (req, res) => {
    const room = roomManager.handleNextPhase(req.params.roomId);
    res.json({ ok: true, room });
  });

  app.post('/api/rooms/:roomId/reset', (req, res) => {
    const room = roomManager.handleReset(req.params.roomId);
    res.json({ ok: true, room });
  });

  app.post('/api/rooms/:roomId/add-ai', (req, res) => {
    const count = Number(req.body.count) || 2;
    const room = roomManager.handleAddAI(req.params.roomId, count);
    res.json({ ok: true, room });
  });

  app.post('/api/rooms/:roomId/kick-team', (req, res) => {
    const { teamId } = req.body;
    const room = roomManager.handleKickTeam(req.params.roomId, teamId);
    res.json({ ok: true, room });
  });

  app.post('/api/rooms/:roomId/set-team-bid', (req, res) => {
    const { teamId, bid, agreedPrice } = req.body;
    roomManager.handleBid(req.params.roomId, teamId, bid, agreedPrice);
    const room = roomManager.getOrCreateRoom(req.params.roomId);
    res.json({ ok: true, room });
  });

  app.post('/api/rooms/:roomId/timer', (req, res) => {
    const { action, seconds } = req.body;
    const room = roomManager.handleTimer(req.params.roomId, action, seconds);
    res.json({ ok: true, room });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (devMode: ${!isProduction})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
