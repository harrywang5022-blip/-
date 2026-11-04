import React from 'react';
import type { RoomState, Team } from '../types/game.ts';
import {
  Trophy,
  Award,
  TrendingUp,
  FileText,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ShoppingBag,
  DollarSign,
  Scale,
} from 'lucide-react';

interface Props {
  roomState: RoomState;
  team: Team;
  onOpenWorksheet: () => void;
}

export const StudentSummaryView: React.FC<Props> = ({
  roomState,
  team,
  onOpenWorksheet,
}) => {
  // Sort teams by total profit to determine rank
  const sortedTeams = [...roomState.teams].sort((a, b) => b.totalProfit - a.totalProfit);
  const rankIndex = sortedTeams.findIndex((t) => t.id === team.id);
  const rank = rankIndex !== -1 ? rankIndex + 1 : 1;
  const totalTeams = roomState.teams.length;

  // Determine playstyle badge based on history
  const history = team.roundHistory;
  const count450 = history.filter((h) => h.bid === 450).length;
  const count400 = history.filter((h) => h.bid === 400).length;
  const count200 = history.filter((h) => h.bid === 200).length;
  const winCount = history.filter((h) => h.isWinner).length;

  let playstyleTitle = '⚖️ 靈活博弈家';
  let playstyleDesc = '在守約與搶單之間敏銳試探市場風向。';
  if (count450 >= 3) {
    playstyleTitle = '🤝 誠信同盟典範';
    playstyleDesc = '堅守高利潤卡特爾協議，展現極高同盟誠信！';
  } else if (count200 >= 2) {
    playstyleTitle = '⚡ 價格破壞之王';
    playstyleDesc = '發動割喉底價價格戰，消費者視你為最大英雄！';
  } else if (count400 >= 2) {
    playstyleTitle = '🎯 敏銳搶單背叛者';
    playstyleDesc = '看準他人開 450 的心理，微幅偷跑獨吞 1200 箱市場！';
  } else if (rank === 1) {
    playstyleTitle = '👑 衛生紙商業霸主';
    playstyleDesc = '利潤最大化贏家，精準掌握定價賽局獲利密碼！';
  }

  // Reflection questions completion count
  const ref = team.reflection;
  const completedQuestions = [
    ref?.r1r2Concern,
    ref?.r3r4Cheating,
    ref?.producerBenefit,
    ref?.consumerBenefit,
    ref?.governmentRole,
  ].filter((text) => !!text && text.trim().length > 0).length;

  return (
    <div className="space-y-6">
      {/* Top Banner: Rank & Honor */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Rank Badge */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/20 backdrop-blur-md border-2 border-white/40 flex flex-col items-center justify-center shrink-0 shadow-lg">
              <span className="text-2xl sm:text-3xl">
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏆'}
              </span>
              <span className="text-xs font-black uppercase tracking-wider mt-0.5">
                第 {rank} 名
              </span>
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold text-amber-100 border border-white/30">
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>賽局榮譽結算</span>
                <span>• 共 {totalTeams} 組競爭</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                {team.brandTag}（第 {team.teamNumber} 組）
              </h2>
              <div className="inline-block px-3 py-1 bg-black/20 rounded-xl text-xs font-bold text-amber-200 mt-1">
                {playstyleTitle}：{playstyleDesc}
              </div>
            </div>
          </div>

          {/* Quick open worksheet button */}
          <button
            onClick={onOpenWorksheet}
            className="w-full sm:w-auto px-5 py-3.5 bg-white text-slate-900 hover:bg-amber-50 font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm shrink-0 active:scale-98"
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>小組反思學習單 ({completedQuestions}/5 題)</span>
          </button>
        </div>
      </div>

      {/* 4 Core Financial Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
          <div className="text-[11px] font-bold text-slate-400 mb-1">累計總淨利潤</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-600">
            ${team.totalProfit.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">扣除成本 $150</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
          <div className="text-[11px] font-bold text-slate-400 mb-1">累計總銷量</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-800">
            {team.totalSoldUnits}
            <span className="text-xs font-normal text-slate-400 ml-1">箱</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">搶佔市場訂單</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
          <div className="text-[11px] font-bold text-slate-400 mb-1">得標勝率</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600">
            {winCount} / {roomState.totalRounds}
            <span className="text-xs font-normal text-slate-400 ml-1">輪</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">成功以最低價得標</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
          <div className="text-[11px] font-bold text-slate-400 mb-1">全班排名</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-indigo-600">
            {rank}
            <span className="text-xs font-normal text-slate-400 ml-1">/ {totalTeams}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">獲利排行位置</div>
        </div>
      </div>

      {/* 4 Rounds History Timeline */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <span>本組四回合決策與市場開價全覽</span>
          </h3>
          <span className="text-xs text-slate-400">R1-R4 完整決策回顧</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((r) => {
            const h = team.roundHistory.find((item) => item.round === r);
            const isNoComm = r <= 2;
            const roundSummary = roomState.roundHistorySummary.find((s) => s.round === r);
            const isWinner = h?.isWinner;

            return (
              <div
                key={r}
                className={`p-4 rounded-2xl border-2 transition-all space-y-2.5 ${
                  isWinner
                    ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-sm">第 {r} 回合</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isNoComm
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isNoComm ? '🚫 禁止溝通' : '💬 開放協商'}
                    </span>
                  </div>

                  {h && (
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-full ${
                        isWinner
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isWinner ? '🏆 得標獲利' : '❌ 未得標'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-400">本組出價</div>
                    <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                      {h ? `${h.bid}元` : '-'}
                    </div>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-400">
                      {isNoComm ? '全場最低價' : '口頭協議價'}
                    </div>
                    <div className="font-mono font-bold text-amber-700 text-sm mt-0.5">
                      {isNoComm
                        ? roundSummary
                          ? `${roundSummary.minPrice}元`
                          : '-'
                        : h?.agreedPrice
                        ? `${h.agreedPrice}元`
                        : '450元'}
                    </div>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-400">本輪獲利</div>
                    <div
                      className={`font-mono font-bold text-sm mt-0.5 ${
                        isWinner ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      +${h ? h.profit.toLocaleString() : '0'}
                    </div>
                  </div>
                </div>

                {/* Subtext description */}
                {h && (
                  <div className="text-[11px] text-slate-600">
                    {isWinner
                      ? `✨ 本輪售出 ${h.unitsSold} 箱，成功奪下訂單！`
                      : `全場最低價為 ${roundSummary?.minPrice || h.marketMinPrice} 元，本組開價較高，銷量為 0 箱。`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reflection Sheet Status & Quick Review */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>小組討論紀錄單填答狀態</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              本組目前已完成 {completedQuestions} / 5 道核心反思問題
            </p>
          </div>

          <button
            onClick={onOpenWorksheet}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            <span>開啟 / 編輯反思學習單</span>
          </button>
        </div>

        {/* 5 Reflection Cards Preview */}
        <div className="space-y-2 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">
              1. 不能溝通時（R1-R2）：不敢開高價（450元）的顧慮是什麼？
            </span>
            <p className="text-slate-600 italic">
              {ref?.r1r2Concern || '（尚未填寫，點擊右上角按鈕即可開始填答）'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">
              2. 開放溝通後（R3-R4）：各組有遵守協議嗎？若有人背叛（偷偷降價），動機是什麼？
            </span>
            <p className="text-slate-600 italic">
              {ref?.r3r4Cheating || '（尚未填寫，點擊右上角按鈕即可開始填答）'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">
              3-(1) 甚麼情況生產者受益最大？
            </span>
            <p className="text-slate-600 italic">
              {ref?.producerBenefit || '（尚未填寫）'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">
              3-(2) 甚麼情況消費者受益最大？
            </span>
            <p className="text-slate-600 italic">
              {ref?.consumerBenefit || '（尚未填寫）'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">
              3-(3) 政府要如何保障消費者受益最大？
            </span>
            <p className="text-slate-600 italic">
              {ref?.governmentRole || '（尚未填寫）'}
            </p>
          </div>
        </div>
      </div>

      {/* Class Leaderboard Overview */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-md space-y-4">
        <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span>全班廠商獲利對比總榜</span>
        </h3>

        <div className="space-y-2">
          {sortedTeams.map((t, idx) => {
            const isMe = t.id === team.id;
            return (
              <div
                key={t.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between text-xs sm:text-sm ${
                  isMe
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                      idx === 0
                        ? 'bg-amber-400 text-slate-950'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-950'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-bold text-slate-900">
                      {t.brandTag} (第 {t.teamNumber} 組)
                    </span>
                    {isMe && (
                      <span className="ml-2 text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                        本組
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-amber-700">
                    ${t.totalProfit.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    售出 {t.totalSoldUnits} 箱
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Civics Key Concepts Takeaway Card */}
      <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-7 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5">
          <Scale className="w-6 h-6 text-amber-400" />
          <h3 className="text-lg font-black text-amber-300">
            公民課重點總結：安屎之亂與市場賽局
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-relaxed">
          <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 space-y-1.5">
            <div className="font-bold text-amber-400">1. 囚徒困境的背叛誘因</div>
            <p className="text-slate-300">
              各廠商即使口頭承諾開 450 元，但只要有人偷開 400
              元就能獨吞全場所有利潤。個人的理性最優解，往往造就集體兩敗俱傷的價格戰。
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 space-y-1.5">
            <div className="font-bold text-amber-400">2. 寡占市場與卡特爾 (Cartel)</div>
            <p className="text-slate-300">
              衛生紙等民生物資廠商少、需求彈性小。廠商私下聯合定價雖能創造暴利，但因缺乏法律約束且存在背叛誘因，同盟極易瓦解。
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 space-y-1.5">
            <div className="font-bold text-amber-400">3. 《公平交易法》的角色</div>
            <p className="text-slate-300">
              法律明文禁止廠商相互協議價格的「聯合行為」，防止廠商壟斷剝削消費者剩餘，以確保自由公平競爭與消費者權益。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
