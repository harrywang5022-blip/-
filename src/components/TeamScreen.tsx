import React, { useState } from 'react';
import type { RoomState, Team, BidPrice, TeamReflection } from '../types/game.ts';
import { WorksheetModal } from './WorksheetModal.tsx';
import { StudentSummaryView } from './StudentSummaryView.tsx';
import {
  DollarSign,
  FileText,
  Lock,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Trophy,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { sound } from '../utils/audio.ts';

interface Props {
  roomState: RoomState;
  team: Team;
  onSubmitBid: (bid: BidPrice, agreedPrice?: number) => void;
  onSubmitReflection: (reflection: TeamReflection) => void;
}

export const TeamScreen: React.FC<Props> = ({
  roomState,
  team,
  onSubmitBid,
  onSubmitReflection,
}) => {
  const [selectedBid, setSelectedBid] = useState<BidPrice | null>(team.currentBid);
  const [agreedPriceInput, setAgreedPriceInput] = useState<string>(
    team.currentAgreedPrice ? String(team.currentAgreedPrice) : '450'
  );
  const [showWorksheet, setShowWorksheet] = useState(false);

  const handleSelectBid = (price: BidPrice) => {
    setSelectedBid(price);
    sound.playPop();
  };

  const handleConfirmSubmit = () => {
    if (!selectedBid) return;
    const agreedNum = roomState.currentRound >= 3 ? Number(agreedPriceInput) || 450 : undefined;
    onSubmitBid(selectedBid, agreedNum);
  };

  const currentRound = roomState.currentRound;
  const isNoComm = currentRound <= 2;
  const isBidding = roomState.status === 'BIDDING';
  const isResult = roomState.status === 'ROUND_RESULT';
  const isDiscussion = roomState.status === 'DISCUSSION' || roomState.status === 'GAME_OVER';

  const lastHistory = team.roundHistory[team.roundHistory.length - 1];

  return (
    <div className="min-h-[calc(100vh-65px)] bg-gradient-to-b from-amber-50/50 via-slate-50 to-orange-50/40 p-4 sm:p-6 pb-20">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Team Identity Header */}
        <div className="bg-white rounded-3xl p-5 border-2 border-amber-200/80 shadow-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-sm"
              style={{ backgroundColor: team.color }}
            >
              {team.teamNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-900 text-lg sm:text-xl">
                  {team.brandTag}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
                  第 {team.teamNumber} 組
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-xs mt-0.5">
                組員：{team.members || '全體組員'}
              </p>
            </div>
          </div>

          {/* Worksheet Trigger Button */}
          <button
            onClick={() => setShowWorksheet(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-colors shadow-2xs"
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>小組紀錄單</span>
          </button>
        </div>

        {/* Stats Pill Bar (shown during active game) */}
        {!isDiscussion && (
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400">累計淨獲利</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-600">
                ${team.totalProfit.toLocaleString()}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400">累計總銷量</div>
              <div className="text-xl sm:text-2xl font-black font-mono text-slate-800">
                {team.totalSoldUnits}{' '}
                <span className="text-xs font-normal text-slate-400">箱</span>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 1: LOBBY */}
        {roomState.status === 'LOBBY' && (
          <div className="bg-white rounded-3xl p-8 border border-amber-200 text-center shadow-lg space-y-4">
            <div className="text-5xl animate-bounce">🧻</div>
            <h3 className="text-xl font-black text-slate-900">成功加入房間：{roomState.roomId}</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              請注視教室前方投影黑板，等待老師正式點擊開始！
              你可以先與組員確認彼此的策略與代表品牌特色。
            </p>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 text-left space-y-1.5">
              <div className="font-bold">💡 賽局定價鐵則：</div>
              <div>・消費者只買「全場最低價」。開高者銷量直接為 0！</div>
              <div>・若同為最低價，所有最低價廠商平分市場 1200 箱。</div>
              <div>・每箱基本生產成本為 150 元。</div>
            </div>
          </div>
        )}

        {/* STAGE 2: BIDDING (出價) */}
        {isBidding && (
          <div className="space-y-4">
            {/* Rule Callout Banner */}
            <div
              className={`p-4 rounded-2xl border ${
                isNoComm
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>{isNoComm ? '🚫' : '💬'}</span>
                <span>
                  第 {currentRound} 回合：{isNoComm ? '禁止私下溝通！' : '開放跨組協商！'}
                </span>
              </div>
              <p className="text-xs mt-1 leading-relaxed">
                {isNoComm
                  ? '禁止與其他組對話或打暗號。請獨立秘密決定本組出價！'
                  : '你們可以離座找其他組商量「全體協議價」，達成口頭共識。但回到手機前，你們真的要守約嗎？'}
              </p>
            </div>

            {/* If R3 or R4: Agreed price input field */}
            {!isNoComm && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <label className="text-xs font-bold text-slate-700">
                  跨組商量好的「協議價」是：
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={agreedPriceInput}
                    onChange={(e) => setAgreedPriceInput(e.target.value)}
                    placeholder="450"
                    className="w-24 text-center font-bold px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:border-amber-500 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-500 font-bold">元</span>
                </div>
              </div>
            )}

            {/* 3 Price Cards */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-500 px-1">
                請在下方三個定價中三選一：
              </div>

              {/* Card 450 */}
              <div
                onClick={() => handleSelectBid(450)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative shadow-sm ${
                  selectedBid === 450
                    ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-300 scale-101'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500 text-white font-black flex items-center justify-center text-lg">
                      $
                    </div>
                    <div>
                      <div className="font-black text-lg text-slate-900">
                        450 <span className="text-xs font-normal text-slate-500">元</span>
                      </div>
                      <div className="text-xs font-bold text-blue-700">高利潤・協商合作價</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 font-bold">
                      單箱毛利 +$300
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  若全員皆開 450 元，大家共享最高利潤。但只要有任一組偷開 400 或 200，本組將<strong>賣出 0 箱</strong>！
                </p>
              </div>

              {/* Card 400 */}
              <div
                onClick={() => handleSelectBid(400)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative shadow-sm ${
                  selectedBid === 400
                    ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-300 scale-101'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black flex items-center justify-center text-lg">
                      $
                    </div>
                    <div>
                      <div className="font-black text-lg text-slate-900">
                        400 <span className="text-xs font-normal text-slate-500">元</span>
                      </div>
                      <div className="text-xs font-bold text-amber-700">搶單價・微幅偷跑背叛</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 font-bold">
                      單箱毛利 +$250
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  比 450 元便宜 50 元。若其他組都守約開 450，你將一人獨得 1200 箱所有訂單，狂賺 $300,000！
                </p>
              </div>

              {/* Card 200 */}
              <div
                onClick={() => handleSelectBid(200)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative shadow-sm ${
                  selectedBid === 200
                    ? 'border-rose-500 bg-rose-50/80 ring-2 ring-rose-300 scale-101'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-600 text-white font-black flex items-center justify-center text-lg">
                      $
                    </div>
                    <div>
                      <div className="font-black text-lg text-slate-900">
                        200 <span className="text-xs font-normal text-slate-500">元</span>
                      </div>
                      <div className="text-xs font-bold text-rose-700">破盤價・極限割喉價格戰</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-800 font-bold">
                      單箱毛利 +$50
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  保本破盤底價！消費者最愛的白菜價。保證無人能比你更低，但每箱利潤極低，全員皆開此價將兩敗俱傷。
                </p>
              </div>
            </div>

            {/* Submission confirmation bar */}
            <div className="pt-2">
              {team.hasSubmitted ? (
                <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-6 h-6 shrink-0" />
                    <div>
                      <div className="font-black text-sm">出價已成功送出！({selectedBid} 元)</div>
                      <div className="text-[11px] text-emerald-100">
                        正在等待全班其他廠商出價與大螢幕揭曉...
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleConfirmSubmit}
                    className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-bold shrink-0"
                  >
                    修改出價
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConfirmSubmit}
                  disabled={!selectedBid}
                  className="w-full py-4 bg-amber-600 hover:bg-amber-700 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-lg rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-5 h-5" />
                  確認送出本組定價 ({selectedBid ? `${selectedBid} 元` : '請先選取價格'})
                </button>
              )}
            </div>
          </div>
        )}

        {/* STAGE 3: ROUND_RESULT (開票結果) */}
        {isResult && lastHistory && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-3xl border-2 shadow-xl text-center space-y-3 ${
                lastHistory.isWinner
                  ? 'bg-gradient-to-b from-amber-100 to-amber-50 border-amber-400'
                  : 'bg-white border-slate-300'
              }`}
            >
              <div className="text-4xl">{lastHistory.isWinner ? '🎉' : '💔'}</div>
              <h3 className="text-2xl font-black text-slate-900">
                {lastHistory.isWinner
                  ? `恭喜得標！本組售出 ${lastHistory.unitsSold} 箱！`
                  : '本回合未得標（銷量 0 箱）！'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                {lastHistory.isWinner
                  ? `本組開價 ${lastHistory.bid} 元為全場最低價！成功奪得市場，淨賺 $${lastHistory.profit.toLocaleString()} 元！`
                  : `全場最低價為 ${lastHistory.marketMinPrice} 元，本組開價 ${lastHistory.bid} 元偏高，訂單全被搶走做白工！`}
              </p>

              {/* Round Score Card */}
              <div className="grid grid-cols-3 gap-2 pt-3 max-w-sm mx-auto text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="text-slate-400 text-[10px]">本輪出價</div>
                  <div className="font-mono font-bold text-slate-800 text-sm">
                    {lastHistory.bid} 元
                  </div>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="text-slate-400 text-[10px]">全場最低價</div>
                  <div className="font-mono font-bold text-amber-600 text-sm">
                    {lastHistory.marketMinPrice} 元
                  </div>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="text-slate-400 text-[10px]">本輪淨獲利</div>
                  <div
                    className={`font-mono font-bold text-sm ${
                      lastHistory.isWinner ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    +${lastHistory.profit.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt to open Worksheet */}
            <button
              onClick={() => setShowWorksheet(true)}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              打開本組學習單紀錄本輪結果與反思
            </button>
          </div>
        )}

        {/* STAGE 4: DISCUSSION / GAME_OVER (Comprehensive Student End-game Summary) */}
        {isDiscussion && (
          <StudentSummaryView
            roomState={roomState}
            team={team}
            onOpenWorksheet={() => setShowWorksheet(true)}
          />
        )}
      </div>

      {/* Floating Worksheet Modal */}
      <WorksheetModal
        isOpen={showWorksheet}
        onClose={() => setShowWorksheet(false)}
        team={team}
        onSubmitReflection={onSubmitReflection}
      />
    </div>
  );
};
