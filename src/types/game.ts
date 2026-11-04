export type BidPrice = 450 | 400 | 200;

export type CommRule = 'NO_COMM' | 'OPEN_COMM';

export type GameStatus =
  | 'LOBBY'
  | 'BIDDING'
  | 'REVEALING'
  | 'ROUND_RESULT'
  | 'DISCUSSION'
  | 'GAME_OVER';

export interface TeamReflection {
  r1r2Concern: string;
  r3r4Cheating: string;
  producerBenefit: string;
  consumerBenefit: string;
  governmentRole: string;
  submittedAt?: number;
}

export interface RoundResult {
  round: number;
  commRule: CommRule;
  bid: BidPrice;
  agreedPrice?: number | null;
  marketMinPrice: number;
  isWinner: boolean;
  unitsSold: number;
  revenue: number;
  profit: number;
  allBids: Record<string, BidPrice>; // teamId -> bid
}

export interface Team {
  id: string;
  teamNumber: number;
  name: string;
  members: string;
  brandTag: string; // e.g. 舒潔, 五月花, 春風, 蒲公英
  color: string;
  connected: boolean;
  isAI?: boolean;
  aiStrategy?: 'GREEDY_CHEATER' | 'HONEST_CARTEL' | 'PRICE_WARRIOR' | 'RANDOM';
  currentBid: BidPrice | null;
  currentAgreedPrice: number | null;
  hasSubmitted: boolean;
  totalProfit: number;
  totalRevenue: number;
  totalSoldUnits: number;
  roundHistory: RoundResult[];
  reflection: TeamReflection;
}

export interface ExtremeCondition {
  type: 'ALL_450' | 'ALL_200' | 'SOLO_BETRAYER' | 'CARTEL_BROKEN' | 'SPLIT_MARKET' | 'NORMAL';
  title: string;
  description: string;
  civicsInsight: string;
}

export interface RoomState {
  roomId: string;
  roomName: string;
  status: GameStatus;
  currentRound: number; // 1, 2, 3, 4 (or custom)
  totalRounds: number; // default 4
  marketDemand: number; // default 1200
  costPerUnit: number; // default 150
  commRule: CommRule; // R1-R2 = NO_COMM, R3-R4 = OPEN_COMM
  negotiationSecondsRemaining: number;
  isTimerRunning: boolean;
  teams: Team[];
  lastRoundExtreme?: ExtremeCondition | null;
  roundHistorySummary: {
    round: number;
    commRule: CommRule;
    minPrice: number;
    winnerTeamIds: string[];
    bidsCount: Record<BidPrice, number>;
    consumerSurplusScore: number; // 1-100
  }[];
}

export type WSClientMessage =
  | { type: 'JOIN_HOST'; roomId: string }
  | { type: 'JOIN_TEAM'; roomId: string; teamInfo: { teamId?: string; teamNumber: number; name: string; members: string; brandTag: string } }
  | { type: 'SUBMIT_BID'; roomId: string; teamId: string; bid: BidPrice; agreedPrice?: number }
  | { type: 'SUBMIT_REFLECTION'; roomId: string; teamId: string; reflection: TeamReflection }
  | { type: 'HOST_START_ROUND'; roomId: string; round: number }
  | { type: 'HOST_FORCE_REVEAL'; roomId: string }
  | { type: 'HOST_NEXT_PHASE'; roomId: string }
  | { type: 'HOST_START_TIMER'; roomId: string; seconds: number }
  | { type: 'HOST_PAUSE_TIMER'; roomId: string }
  | { type: 'HOST_ADD_AI_TEAMS'; roomId: string; count: number }
  | { type: 'HOST_RESET_GAME'; roomId: string }
  | { type: 'HOST_KICK_TEAM'; roomId: string; teamId: string }
  | { type: 'HOST_SET_TEAM_BID'; roomId: string; teamId: string; bid: BidPrice; agreedPrice?: number }
  | { type: 'HOST_SET_ROOM_CONFIG'; roomId: string; marketDemand?: number; costPerUnit?: number }
  | { type: 'PING' };

export type WSServerMessage =
  | { type: 'ROOM_STATE'; state: RoomState; yourTeamId?: string }
  | { type: 'BID_ACCEPTED'; teamId: string }
  | { type: 'REVEAL_EFFECT'; minPrice: number; winnerIds: string[]; extreme: ExtremeCondition }
  | { type: 'TIMER_TICK'; seconds: number }
  | { type: 'ERROR'; message: string }
  | { type: 'PONG' };
