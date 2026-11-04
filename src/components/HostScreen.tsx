import React, { useEffect, useState } from 'react';
import type { RoomState, Team, BidPrice } from '../types/game.ts';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  Users,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Copy,
  Check,
  Clock,
  Pause,
  AlertTriangle,
  Award,
  ArrowRight,
  UserPlus,
  Maximize2,
  Trash2,
  TrendingUp,
  MessageSquare,
  HelpCircle,
  Eye,
  ShieldCheck,
  Globe,
  Edit3,
  ExternalLink,
  Download,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { sound } from '../utils/audio.ts';
import { getRecommendedShareOrigin, buildJoinUrl } from '../utils/url.ts';
import { exportRoomDataToCSV } from '../utils/exportData.ts';
import { PrintableReportModal } from './PrintableReportModal.tsx';

interface Props {
  roomState: RoomState;
  onStartRound: (round: number) => void;
  onForceReveal: () => void;
  onNextPhase: () => void;
  onAddAI: (count: number) => void;
  onReset: () => void;
  onKickTeam: (teamId: string) => void;
  onSetTeamBid: (teamId: string, bid: BidPrice, agreedPrice?: number) => void;
  onStartTimer: (seconds?: number) => void;
  onPauseTimer: () => void;
}

export const HostScreen: React.FC<Props> = ({
  roomState,
  onStartRound,
  onForceReveal,
  onNextPhase,
  onAddAI,
  onReset,
  onKickTeam,
  onSetTeamBid,
  onStartTimer,
  onPauseTimer,
}) => {
  const urlInfo = getRecommendedShareOrigin();
  // Default to window.location.origin so Host and Students connect to the EXACT SAME server!
  const [activeOrigin, setActiveOrigin] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.origin : urlInfo.currentOrigin;
  });
  const [customOriginInput, setCustomOriginInput] = useState<string>('');
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [showBoardInputModal, setShowBoardInputModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [selectedReflectionQ, setSelectedReflectionQ] = useState<
    'r1r2' | 'r3r4' | 'producer' | 'consumer' | 'gov'
  >('r1r2');
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);

  // Current Join URL for students
  const joinUrl = buildJoinUrl(roomState.roomId, activeOrigin);

  // Generate QR Code with join URL
  useEffect(() => {
    QRCode.toDataURL(
      joinUrl,
      {
        width: 240,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      },
      (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      }
    );
  }, [joinUrl]);

  // Trigger celebration on ROUND_RESULT
  useEffect(() => {
    if (roomState.status === 'ROUND_RESULT') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    }
  }, [roomState.status, roomState.currentRound]);

  const copyJoinLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeTeams = roomState.teams;
  const submittedCount = activeTeams.filter((t) => t.hasSubmitted).length;
  const allSubmitted = activeTeams.length > 0 && submittedCount === activeTeams.length;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Top Control Bar for Projector */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          {/* Room code and direct link */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-amber-400 tracking-wider uppercase">
                大螢幕教室投影
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-widest">
                  {roomState.roomId}
                </span>
                <button
                  onClick={copyJoinLink}
                  title="複製連線連結"
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors flex items-center gap-1 text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '已複製' : '連線網址'}</span>
                </button>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-700 hidden sm:block" />

            {/* Rounds stepper */}
            <div className="flex items-center gap-2 text-xs">
              {[1, 2, 3, 4].map((r) => {
                const isCurrent = roomState.currentRound === r && roomState.status !== 'LOBBY';
                const isPassed = roomState.currentRound > r || roomState.status === 'DISCUSSION' || roomState.status === 'GAME_OVER';
                return (
                  <div
                    key={r}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                      isCurrent
                        ? 'bg-amber-500 text-white ring-2 ring-amber-300 shadow-md scale-105'
                        : isPassed
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    <span>R{r}</span>
                    <span className="text-[10px] hidden md:inline">
                      {r <= 2 ? '🚫 禁' : '💬 協'}
                    </span>
                  </div>
                );
              })}
              <div
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                  roomState.status === 'DISCUSSION' || roomState.status === 'GAME_OVER'
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                反思與法規
              </div>
            </div>
          </div>

          {/* Quick Host Operations */}
          <div className="flex items-center gap-2">
            {/* Export data buttons */}
            <button
              onClick={() => exportRoomDataToCSV(roomState)}
              title="匯出全班數據總結至 Excel / CSV"
              className="px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">匯出 CSV</span>
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              title="查看並列印班級總結報告 (PDF)"
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-amber-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">總結報告</span>
            </button>

            {/* Permission troubleshooting button */}
            <button
              onClick={() => setShowPermissionModal(true)}
              className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">掃碼權限說明</span>
            </button>

            {roomState.status === 'LOBBY' && (
              <button
                onClick={() => onAddAI(2)}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                +2 AI
              </button>
            )}

            <button
              onClick={onReset}
              title="重設遊戲回大廳"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* VIEW 1: LOBBY */}
        {roomState.status === 'LOBBY' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left QR Code & Connect Instruction (5 cols) */}
            <div className="lg:col-span-5 bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-xl">
              <span className="text-xs font-bold text-amber-400 tracking-wider mb-1">
                請各組拿出手機掃碼或輸入代碼
              </span>
              
              {/* QR Code */}
              <div className="p-3 bg-white rounded-2xl shadow-lg my-3">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Room QR Code" className="w-48 h-48 sm:w-56 sm:h-56" />
                ) : (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 bg-slate-100 flex items-center justify-center text-slate-400">
                    載入中...
                  </div>
                )}
              </div>

              {/* URL and permission badge */}
              <div className="w-full space-y-2 mt-1">
                <div className="text-xs text-slate-300 font-mono bg-slate-900/80 py-1.5 px-3 rounded-lg border border-slate-700 truncate text-center">
                  {joinUrl}
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {activeOrigin === (typeof window !== 'undefined' ? window.location.origin : '')
                      ? '✅ 與大螢幕同源（即時秒同步）'
                      : '⚠️ 注意：不同伺服器網址'}
                  </span>
                  <button
                    onClick={() => setShowPermissionModal(true)}
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    設定/切換
                  </button>
                </div>

                {urlInfo.isDevUrl && (
                  <div className="p-3 bg-amber-950/70 border border-amber-500/50 rounded-2xl text-left text-[11px] text-amber-200 leading-relaxed space-y-2 mt-2">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>多人連線同步說明</span>
                    </div>
                    <p className="text-slate-300">
                      目前 QR Code 已自動對齊當前大螢幕網址。若要讓學生免 Google 登入，請點擊下方在新分頁打開公開大螢幕，讓師生都在公開網址上互動：
                    </p>
                    <a
                      href={`${urlInfo.sharedUrl}?role=host&room=${roomState.roomId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-sm transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      在新分頁開啟「正式公開大螢幕 (ais-pre)」
                    </a>
                  </div>
                )}
              </div>

              <div className="w-full mt-5 pt-5 border-t border-slate-700 flex flex-col gap-2">
                <button
                  onClick={() => onStartRound(1)}
                  disabled={roomState.teams.length < 1}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xl rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <Play className="w-6 h-6 fill-white" />
                  正式開始第 1 回合 (R1)
                </button>
                {roomState.teams.length === 0 && (
                  <span className="text-xs text-rose-400 font-semibold mt-1">
                    尚無小組加入，可點擊上方「+2 模擬 AI 隊」或請學生手機連線！
                  </span>
                )}
              </div>
            </div>

            {/* Right Joined Teams List (7 cols) */}
            <div className="lg:col-span-7 bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-lg text-white">
                    已就緒衛生紙廠商（{roomState.teams.length} 組）
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 bg-amber-950 text-amber-300 border border-amber-700 rounded-full font-bold">
                  市場總需求：{roomState.marketDemand} 箱
                </span>
              </div>

              {roomState.teams.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-700 rounded-2xl space-y-3">
                  <div className="text-4xl">🧻</div>
                  <div className="text-slate-400 font-bold">等待各組連線加入中...</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    學生手機掃瞄左側 QR Code，選擇組別與經典台灣衛生紙品牌（舒潔、五月花、春風等）即可進入！
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {roomState.teams.map((team) => (
                    <div
                      key={team.id}
                      className="p-3.5 rounded-2xl bg-slate-700/60 border border-slate-600 flex items-center justify-between gap-2 shadow-xs group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-md"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.teamNumber}
                        </div>
                        <div>
                          <div className="font-black text-sm text-white flex items-center gap-1.5">
                            <span>{team.brandTag}</span>
                            {team.isAI && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-600 text-slate-300 rounded font-normal">
                                AI
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-[140px]">
                            {team.members || '無組員名單'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onKickTeam(team.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                        title="移除此組"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: BIDDING (出價階段) */}
        {roomState.status === 'BIDDING' && (
          <div className="space-y-6">
            {/* Rule & Phase Announcement Banner */}
            <div
              className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 ${
                roomState.currentRound <= 2
                  ? 'bg-gradient-to-r from-rose-950/70 via-slate-800 to-slate-900 border-rose-500/40'
                  : 'bg-gradient-to-r from-emerald-950/70 via-slate-800 to-slate-900 border-emerald-500/40'
              }`}
            >
              <div className="space-y-2 text-center md:text-left">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      roomState.currentRound <= 2
                        ? 'bg-rose-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    第 {roomState.currentRound} 回合決策進行中
                  </span>
                  <span className="text-sm font-bold text-slate-300">
                    {roomState.currentRound <= 2 ? '🚫 獨立決策模式' : '💬 開放協商模式'}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {roomState.currentRound <= 2
                    ? '嚴禁跨組溝通！秘密開價考驗人性'
                    : '開放跨組協商！請各廠商自由走動談判'}
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  {roomState.currentRound <= 2
                    ? '全班廠商禁止私下交談或對暗號。每組只能在 450元 / 400元 / 200元 之間三選一。全場只有最低價能獨拿訂單！'
                    : '各組可離座與競爭對手商量「協議價」（例如全體約定 450 元共創暴利）。但回到手機螢幕前，你會遵守約定？還是偷偷降價？'}
                </p>
              </div>

              {/* Timer for negotiation (if R3/R4) */}
              {roomState.currentRound >= 3 && (
                <div className="bg-slate-800/90 border border-emerald-500/30 rounded-2xl p-4 flex flex-col items-center shrink-0 min-w-[200px]">
                  <span className="text-xs text-slate-400 flex items-center gap-1 font-bold">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> 協商倒數計時
                  </span>
                  <span className="text-3xl sm:text-4xl font-mono font-black text-emerald-400 my-1">
                    {formatTimer(roomState.negotiationSecondsRemaining)}
                  </span>
                  <div className="flex gap-2 mt-1">
                    {roomState.isTimerRunning ? (
                      <button
                        onClick={onPauseTimer}
                        className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 font-bold"
                      >
                        暫停
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartTimer(90)}
                        className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold"
                      >
                        啟動 90秒
                      </button>
                    )}
                    <button
                      onClick={() => onStartTimer(roomState.negotiationSecondsRemaining + 30)}
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 font-bold"
                    >
                      +30秒
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Live Submissions Status Grid */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>各組報價進度</span>
                    <span className="text-amber-400 font-mono">
                      ({submittedCount} / {activeTeams.length} 組完成)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    出價內容已全面加密，待全班出價完畢或點擊揭曉按鈕後才會公開！
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBoardInputModal(true)}
                    className="px-4 py-3 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 shadow-md active:scale-98"
                  >
                    <Edit3 className="w-4 h-4 text-indigo-200" />
                    <span>現場白板出價代操</span>
                  </button>

                  <button
                    onClick={onForceReveal}
                    className={`px-6 py-3.5 rounded-xl font-black text-base shadow-lg transition-all flex items-center gap-2 ${
                      allSubmitted
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white animate-bounce shadow-amber-500/30'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    <Eye className="w-5 h-5" />
                    {allSubmitted ? '全員就緒！立即揭曉開票' : '提早強行開票揭曉'}
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-500"
                  style={{
                    width: `${activeTeams.length ? (submittedCount / activeTeams.length) * 100 : 0}%`,
                  }}
                />
              </div>

              {/* Team Cards Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {activeTeams.map((team) => {
                  const submitted = team.hasSubmitted;
                  return (
                    <div
                      key={team.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        submitted
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                          : 'bg-slate-700/40 border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-xs"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.teamNumber}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                            submitted
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          }`}
                        >
                          {submitted ? '🔒 已保密送出' : '⏳ 思考商討中...'}
                        </span>
                      </div>

                      <div className="font-black text-white text-base truncate">
                        {team.brandTag}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {team.members || '組員未填寫'}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                        <span>累計利潤</span>
                        <span className="font-mono font-bold text-amber-400">
                          ${team.totalProfit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: ROUND_RESULT (開票揭曉與結算) */}
        {roomState.status === 'ROUND_RESULT' && (
          <div className="space-y-6">
            {/* Extreme condition headline */}
            {roomState.lastRoundExtreme && (
              <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-600/30 via-orange-600/20 to-slate-800 border-2 border-amber-400/60 shadow-2xl space-y-2">
                <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-wide">
                  {roomState.lastRoundExtreme.title}
                </div>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  {roomState.lastRoundExtreme.description}
                </p>
                <div className="pt-2 text-xs text-amber-200 flex items-center gap-2 bg-black/30 p-2.5 rounded-xl border border-amber-500/30">
                  <span className="font-bold shrink-0">🏛️ 公民知識點評：</span>
                  <span>{roomState.lastRoundExtreme.civicsInsight}</span>
                </div>
              </div>
            )}

            {/* Revealed Cards Grid */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>第 {roomState.currentRound} 回合・全場開票結果</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    市場總量 {roomState.marketDemand} 箱衛生紙全部由最低價廠商獨得或平分！
                  </p>
                </div>

                <button
                  onClick={onNextPhase}
                  className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-base rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-98"
                >
                  {roomState.currentRound < roomState.totalRounds ? (
                    <>
                      <span>前往第 {roomState.currentRound + 1} 回合</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      <span>查看全班反思學習單與公民總結</span>
                      <Award className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              {/* Grid of Results */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {roomState.teams.map((team) => {
                  const lastRes = team.roundHistory[team.roundHistory.length - 1];
                  const isWinner = lastRes?.isWinner;
                  const bid = team.currentBid;

                  return (
                    <div
                      key={team.id}
                      className={`p-5 rounded-2xl border-2 transition-all relative overflow-hidden ${
                        isWinner
                          ? 'bg-amber-950/40 border-amber-400 shadow-xl ring-2 ring-amber-400/50 scale-102'
                          : 'bg-slate-700/40 border-slate-600 opacity-80'
                      }`}
                    >
                      {isWinner && (
                        <div className="absolute top-2 right-2 bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <Trophy className="w-3 h-3" /> 得標獲利
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.teamNumber}
                        </span>
                        <span className="font-bold text-white text-sm truncate">
                          {team.brandTag}
                        </span>
                      </div>

                      {/* Bid Price Display */}
                      <div className="my-3 text-center py-2 bg-slate-900/60 rounded-xl border border-slate-700">
                        <div className="text-[11px] text-slate-400">本回合出價</div>
                        <div
                          className={`text-3xl font-black font-mono ${
                            bid === 450
                              ? 'text-blue-400'
                              : bid === 400
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {bid} <span className="text-xs font-normal text-slate-300">元</span>
                        </div>
                        {team.currentAgreedPrice && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            協議價: {team.currentAgreedPrice}元
                          </div>
                        )}
                      </div>

                      {/* Performance this round */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>本輪銷量</span>
                          <span className="font-bold font-mono">
                            {lastRes ? `${lastRes.unitsSold} 箱` : '0 箱'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>本輪淨利潤</span>
                          <span
                            className={`font-bold font-mono ${
                              isWinner ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            +${lastRes ? lastRes.profit.toLocaleString() : '0'}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-700 flex justify-between text-slate-200 font-bold">
                          <span>累計總利潤</span>
                          <span className="font-mono text-amber-400">
                            ${team.totalProfit.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Consumer Satisfaction & Market Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Leaderboard */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-3">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  目前廠商獲利排行榜
                </h4>
                <div className="space-y-2">
                  {[...roomState.teams]
                    .sort((a, b) => b.totalProfit - a.totalProfit)
                    .map((t, idx) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-700/50 border border-slate-600 text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                              idx === 0
                                ? 'bg-amber-400 text-slate-950 font-black'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-950'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-bold text-white">{t.brandTag}</span>
                          <span className="text-slate-400 text-xs hidden sm:inline">
                            (第 {t.teamNumber} 組)
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-amber-400">
                            ${t.totalProfit.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            共售出 {t.totalSoldUnits} 箱
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Price summary & Consumer gauge */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-white flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    消費者福祉與市場價格戰評估
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    在衛生紙之亂中，消費者的利益與廠商獲利呈現完全相反的博弈拉鋸。
                  </p>
                </div>

                {/* Price votes distribution */}
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 space-y-2">
                  <div className="text-xs font-bold text-slate-300">各價位廠商開價數量：</div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-500/30">
                      <div className="font-mono font-bold text-blue-400 text-lg">
                        {roomState.teams.filter((t) => t.currentBid === 450).length} 家
                      </div>
                      <div className="text-[11px] text-slate-300">450 元 (高價)</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/30">
                      <div className="font-mono font-bold text-amber-400 text-lg">
                        {roomState.teams.filter((t) => t.currentBid === 400).length} 家
                      </div>
                      <div className="text-[11px] text-slate-300">400 元 (搶單)</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/30">
                      <div className="font-mono font-bold text-red-400 text-lg">
                        {roomState.teams.filter((t) => t.currentBid === 200).length} 家
                      </div>
                      <div className="text-[11px] text-slate-300">200 元 (流血)</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 bg-slate-700/30 p-3 rounded-xl">
                  <strong>💡 老師提問小錦囊：</strong>
                  「當有人開 200 元時，消費者最高興，但開 200 元的廠商真的賺很多嗎？還是大家都在替消費者做白工？」
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: DISCUSSION & GAME_OVER (全班反思學習單牆) */}
        {(roomState.status === 'DISCUSSION' || roomState.status === 'GAME_OVER') && (
          <div className="space-y-6">
            {/* Header */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900/60 via-slate-800 to-slate-900 border border-indigo-500/30 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold px-2.5 py-1 bg-indigo-500 text-white rounded-full">
                  賽局核心探討與公民素養
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1.5">
                  全班反思學習單與論壇投影
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                  各組已在手機端完成討論學習單。點選下方問題與小組，可將組員反思即時放大至全螢幕進行課堂辯論！
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => exportRoomDataToCSV(roomState)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>匯出全班數據 (CSV/Excel)</span>
                </button>

                <button
                  onClick={() => setShowReportModal(true)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-98"
                >
                  <Printer className="w-4 h-4" />
                  <span>列印總結報告 (PDF)</span>
                </button>

                <button
                  onClick={() => onStartRound(1)}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-colors"
                >
                  重啟新一輪賽局
                </button>
              </div>
            </div>

            {/* Question Selector Tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedReflectionQ('r1r2')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  selectedReflectionQ === 'r1r2'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                1. 不能溝通時（R1-R2）的顧慮
              </button>
              <button
                onClick={() => setSelectedReflectionQ('r3r4')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  selectedReflectionQ === 'r3r4'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                2. 開放溝通後（R3-R4）的背叛誘因
              </button>
              <button
                onClick={() => setSelectedReflectionQ('producer')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  selectedReflectionQ === 'producer'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                3. 何時生產者受益最大？
              </button>
              <button
                onClick={() => setSelectedReflectionQ('consumer')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  selectedReflectionQ === 'consumer'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                4. 何時消費者受益最大？
              </button>
              <button
                onClick={() => setSelectedReflectionQ('gov')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  selectedReflectionQ === 'gov'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                5. 政府要如何保障消費者受益最大？
              </button>
            </div>

            {/* Reflection Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roomState.teams.map((team) => {
                const getAnswerText = () => {
                  switch (selectedReflectionQ) {
                    case 'r1r2':
                      return team.reflection?.r1r2Concern;
                    case 'r3r4':
                      return team.reflection?.r3r4Cheating;
                    case 'producer':
                      return team.reflection?.producerBenefit;
                    case 'consumer':
                      return team.reflection?.consumerBenefit;
                    case 'gov':
                      return team.reflection?.governmentRole;
                  }
                };

                const answerContent = getAnswerText();
                const hasAnswered = !!answerContent && answerContent.trim().length > 0;

                return (
                  <div
                    key={team.id}
                    onClick={() => setFocusedTeamId(team.id)}
                    className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 hover:border-amber-400/80 cursor-pointer transition-all shadow-md hover:scale-101 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-xs"
                            style={{ backgroundColor: team.color }}
                          >
                            {team.teamNumber}
                          </span>
                          <span className="font-bold text-white text-sm">{team.brandTag}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" /> 點擊放大
                        </span>
                      </div>
                      <p
                        className={`text-xs sm:text-sm leading-relaxed line-clamp-5 ${
                          hasAnswered ? 'text-slate-100 font-medium' : 'text-slate-400 italic'
                        }`}
                      >
                        {hasAnswered ? answerContent : '（小組討論中，尚未填寫回答...）'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>組員：{team.members || '全體組員'}</span>
                      <span className="text-amber-400 font-mono font-bold">
                        累計 ${team.totalProfit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Focused Full-Screen Modal for single team's reflection */}
            {focusedTeamId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
                {(() => {
                  const targetTeam = roomState.teams.find((t) => t.id === focusedTeamId);
                  if (!targetTeam) return null;
                  return (
                    <div className="w-full max-w-3xl bg-slate-800 border-2 border-amber-400 rounded-3xl p-6 sm:p-8 space-y-6 text-white shadow-2xl">
                      <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg text-white"
                            style={{ backgroundColor: targetTeam.color }}
                          >
                            {targetTeam.teamNumber}
                          </span>
                          <div>
                            <h3 className="text-xl font-black text-white">
                              {targetTeam.brandTag}・小組反思全覽
                            </h3>
                            <p className="text-xs text-slate-400">組員：{targetTeam.members}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setFocusedTeamId(null)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold"
                        >
                          關閉放大視窗
                        </button>
                      </div>

                      <div className="space-y-4 text-xs sm:text-sm max-h-[60vh] overflow-y-auto pr-2">
                        <div className="p-3.5 rounded-xl bg-slate-700/60 border border-slate-600">
                          <span className="font-bold text-amber-300 block mb-1">
                            1. 不能溝通時（R1-R2）的顧慮：
                          </span>
                          <p className="text-slate-200">
                            {targetTeam.reflection?.r1r2Concern || '未填寫'}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-700/60 border border-slate-600">
                          <span className="font-bold text-amber-300 block mb-1">
                            2. 開放溝通後（R3-R4）的背叛誘因：
                          </span>
                          <p className="text-slate-200">
                            {targetTeam.reflection?.r3r4Cheating || '未填寫'}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-700/60 border border-slate-600">
                          <span className="font-bold text-amber-300 block mb-1">
                            3. (1) 何時生產者受益最大？
                          </span>
                          <p className="text-slate-200">
                            {targetTeam.reflection?.producerBenefit || '未填寫'}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-700/60 border border-slate-600">
                          <span className="font-bold text-amber-300 block mb-1">
                            (2) 何時消費者受益最大？
                          </span>
                          <p className="text-slate-200">
                            {targetTeam.reflection?.consumerBenefit || '未填寫'}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-700/60 border border-slate-600">
                          <span className="font-bold text-amber-300 block mb-1">
                            (3) 政府要如何保障消費者受益最大？
                          </span>
                          <p className="text-slate-200">
                            {targetTeam.reflection?.governmentRole || '未填寫'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Modal 1: Permission Troubleshooting & URL Config */}
        {showPermissionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <div className="w-full max-w-2xl bg-slate-800 border-2 border-amber-400 rounded-3xl p-6 sm:p-8 space-y-6 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-6 h-6 text-amber-400" />
                  <h3 className="text-xl font-black">掃描連線設定與「沒有權限」解決說明</h3>
                </div>
                <button
                  onClick={() => setShowPermissionModal(false)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold"
                >
                  關閉
                </button>
              </div>

              {/* Core explanation */}
              <div className="p-4 bg-amber-950/60 border border-amber-500/50 rounded-2xl space-y-2 text-xs sm:text-sm text-amber-100 leading-relaxed">
                <div className="font-bold text-amber-300 flex items-center gap-1.5 text-base">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  為什麼別人掃描會顯示「沒有權限 (403 Forbidden)」？
                </div>
                <p>
                  因為 Google AI Studio 的開發預覽網址（網址開頭為 <code>ais-dev-</code>）有 Google 帳號身分保護，<strong>只有專案作者本人登入時才能查看</strong>。其他人的手機未取得授權，就會被 Google 阻擋顯示「沒有權限」。
                </p>
              </div>

              {/* Solutions */}
              <div className="space-y-4 text-xs sm:text-sm">
                <h4 className="font-bold text-white text-base">🛠️ 快速解決方式：</h4>

                {/* Solution 1: Pre URL */}
                <div className="p-4 rounded-xl bg-slate-700/60 border border-slate-600 space-y-2">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    方式一：使用系統已為您轉換的「免登入公開網址 (ais-pre)」
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    本系統已自動將 QR Code 與連線連結替換為公開的 <code>ais-pre-</code> 網址。讓學生重新掃描黑板上的 QR Code 或點擊下方複製連結即可！
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        setActiveOrigin(urlInfo.recommendedOrigin);
                        setShowPermissionModal(false);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      套用公開網址 (ais-pre)
                    </button>
                    <button
                      onClick={copyJoinLink}
                      className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg font-bold text-xs flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      複製學生連線網址
                    </button>
                  </div>
                </div>

                {/* Solution 2: Share Button in AI Studio */}
                <div className="p-4 rounded-xl bg-slate-700/60 border border-slate-600 space-y-2">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4" />
                    方式二：在 AI Studio 右上角點擊「Share (分享)」
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    在 AI Studio 畫面右上角點擊 <strong>Share</strong> 按鈕，將專案權限設為「Anyone with the link can view」，發布後即可正式供全班免登入使用。
                  </p>
                </div>

                {/* Solution 3: Hotseat Board Mode */}
                <div className="p-4 rounded-xl bg-slate-700/60 border border-slate-600 space-y-2">
                  <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4" />
                    方式三：使用「現場白板代操出價模式」（推薦！）
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    若學校 Wi-Fi 不穩或學生手機無網路，出價階段可直接點擊「現場白板出價代操」，各組派代表到講台黑板前直接點選出價，無須任何手機！
                  </p>
                </div>

                {/* Custom URL Input */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    自訂連線基礎網址 (Base URL)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customOriginInput}
                      onChange={(e) => setCustomOriginInput(e.target.value)}
                      placeholder={activeOrigin}
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-400 font-mono"
                    />
                    <button
                      onClick={() => {
                        if (customOriginInput.trim()) {
                          setActiveOrigin(customOriginInput.trim().replace(/\/$/, ''));
                          setShowPermissionModal(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shrink-0"
                    >
                      套用
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Classroom Board Input (白板現場出價代操) */}
        {showBoardInputModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <div className="w-full max-w-4xl bg-slate-800 border-2 border-indigo-400 rounded-3xl p-6 sm:p-8 space-y-6 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <div className="flex items-center gap-2.5">
                  <Edit3 className="w-6 h-6 text-indigo-400" />
                  <div>
                    <h3 className="text-xl font-black">現場白板出價代操（各組免手機直接點選）</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      各組代表可上前或由老師代為點選本回合定價，點選後立即保密記錄！
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBoardInputModal(false)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold"
                >
                  完成並返回
                </button>
              </div>

              {/* Teams list with price selection buttons */}
              <div className="space-y-3">
                {activeTeams.map((team) => {
                  const isSubmitted = team.hasSubmitted;
                  const currentBid = team.currentBid;

                  return (
                    <div
                      key={team.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-4 ${
                        isSubmitted
                          ? 'bg-slate-700/80 border-emerald-500/50 ring-1 ring-emerald-500/30'
                          : 'bg-slate-700/40 border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.teamNumber}
                        </span>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-1.5">
                            <span>{team.brandTag}</span>
                            {isSubmitted && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                                已選好
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {team.members || '組員未填寫'}
                          </div>
                        </div>
                      </div>

                      {/* 3 Price Options */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSetTeamBid(team.id, 450)}
                          className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            currentBid === 450
                              ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-md scale-102'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-600 border border-slate-600'
                          }`}
                        >
                          450 元 (高價)
                        </button>
                        <button
                          onClick={() => onSetTeamBid(team.id, 400)}
                          className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            currentBid === 400
                              ? 'bg-amber-600 text-white ring-2 ring-amber-300 shadow-md scale-102'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-600 border border-slate-600'
                          }`}
                        >
                          400 元 (搶單)
                        </button>
                        <button
                          onClick={() => onSetTeamBid(team.id, 200)}
                          className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            currentBid === 200
                              ? 'bg-rose-600 text-white ring-2 ring-rose-300 shadow-md scale-102'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-600 border border-slate-600'
                          }`}
                        >
                          200 元 (破盤)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowBoardInputModal(false)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-md"
                >
                  確認完成各組代操
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 3: Printable Report & PDF Summary */}
        <PrintableReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          roomState={roomState}
        />
      </div>

      {/* Classroom Footer note */}
      <div className="max-w-7xl mx-auto w-full text-center text-xs text-slate-500 pt-6 border-t border-slate-800">
        安屎之亂：衛生紙價格策略賽局 ｜ 公民與社會微觀經濟學教學工具 ｜ 支援多端即時連線與大螢幕白板投影
      </div>
    </div>
  );
};
