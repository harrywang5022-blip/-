import React from 'react';
import type { RoomState } from '../types/game.ts';
import { exportRoomDataToCSV } from '../utils/exportData.ts';
import { Printer, Download, X, Trophy, FileText, CheckCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomState: RoomState;
}

export const PrintableReportModal: React.FC<Props> = ({ isOpen, onClose, roomState }) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const sortedTeams = [...roomState.teams].sort((a, b) => b.totalProfit - a.totalProfit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl max-h-[94vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-300 flex flex-col text-slate-900">
        {/* Header - Screen Only */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-slate-900 text-white rounded-t-3xl shadow-md print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-lg font-bold">
              📊
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">
                班級賽局總結報告（列印 / PDF 預覽）
              </h2>
              <p className="text-xs text-slate-400">房間代碼：{roomState.roomId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportRoomDataToCSV(roomState)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              title="下載 Excel / CSV 格式"
            >
              <Download className="w-4 h-4" />
              <span>匯出 CSV / Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all shadow-xs"
              title="列印或另存為 PDF"
            >
              <Printer className="w-4 h-4" />
              <span>列印 / 另存 PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 space-y-6 printable-report bg-white text-slate-900">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-amber-700 tracking-wider uppercase mb-1">
                公民與社會科・微觀經濟學與市場競爭專題
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950">
                安屎之亂：衛生紙價格策略賽局 — 班級教學總結報告
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                探討寡占市場、卡特爾聯合行為（Cartel）、囚徒困境與公平交易法法規實踐
              </p>
            </div>
            <div className="text-right text-xs text-slate-600 space-y-0.5">
              <div>
                <strong>房間代碼：</strong>
                <span className="font-mono font-bold text-slate-900">{roomState.roomId}</span>
              </div>
              <div>
                <strong>報告產生時間：</strong>
                {new Date().toLocaleString('zh-TW')}
              </div>
              <div>
                <strong>參賽廠商：</strong>
                {roomState.teams.length} 組 ｜ <strong>市場每輪需求：</strong>
                {roomState.marketDemand} 箱
              </div>
            </div>
          </div>

          {/* Section 1: Final Leaderboard */}
          <div className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>一、全班各廠商獲利排行榜與營運成績</span>
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2.5 text-center">排名</th>
                    <th className="p-2.5">組別</th>
                    <th className="p-2.5">廠商品牌</th>
                    <th className="p-2.5">組員</th>
                    <th className="p-2.5 text-right">累計淨獲利</th>
                    <th className="p-2.5 text-right">累計銷量</th>
                    <th className="p-2.5 text-center">得標回合</th>
                    <th className="p-2.5 text-center">R1</th>
                    <th className="p-2.5 text-center">R2</th>
                    <th className="p-2.5 text-center">R3 (協)</th>
                    <th className="p-2.5 text-center">R4 (協)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedTeams.map((team, idx) => {
                    const winCount = team.roundHistory.filter((h) => h.isWinner).length;
                    return (
                      <tr key={team.id} className={idx === 0 ? 'bg-amber-50/60 font-semibold' : ''}>
                        <td className="p-2.5 text-center font-bold">
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                        </td>
                        <td className="p-2.5">第 {team.teamNumber} 組</td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {team.brandTag}
                          {team.isAI ? ' (AI)' : ''}
                        </td>
                        <td className="p-2.5 text-slate-600 truncate max-w-[120px]">
                          {team.members || '全體組員'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-700">
                          ${team.totalProfit.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-800">
                          {team.totalSoldUnits} 箱
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {winCount} / {roomState.totalRounds}
                        </td>
                        {[1, 2, 3, 4].map((r) => {
                          const h = team.roundHistory.find((item) => item.round === r);
                          return (
                            <td key={r} className="p-2.5 text-center font-mono text-[11px]">
                              {h ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded ${
                                    h.isWinner
                                      ? 'bg-emerald-100 text-emerald-800 font-bold'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {h.bid}元
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Rounds Breakdown */}
          <div className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-bold">
                二
              </span>
              <span>四回合市場價格走勢與得標概要</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((r) => {
                const summary = roomState.roundHistorySummary.find((s) => s.round === r);
                const isNoComm = r <= 2;
                return (
                  <div
                    key={r}
                    className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/70 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-sm text-slate-900">第 {r} 回合</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isNoComm
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isNoComm ? '🚫 禁止溝通' : '💬 開放協商'}
                      </span>
                    </div>
                    <div className="pt-1 flex items-baseline justify-between">
                      <span className="text-slate-500">市場最低得標價:</span>
                      <span className="font-mono font-bold text-sm text-amber-700">
                        {summary ? `${summary.minPrice} 元` : '未結算'}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-[11px] text-slate-600">
                      <span>得標廠商數:</span>
                      <span className="font-bold">
                        {summary ? `${summary.winnerTeamIds.length} 家` : '-'}
                      </span>
                    </div>
                    {summary && summary.bidsCount && (
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex justify-between">
                        <span>450元: {summary.bidsCount[450] || 0}家</span>
                        <span>400元: {summary.bidsCount[400] || 0}家</span>
                        <span>200元: {summary.bidsCount[200] || 0}家</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Student Reflection Responses */}
          <div className="space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>三、各組反思學習單詳細填答成果彙整</span>
            </h2>

            <div className="space-y-4">
              {roomState.teams.map((team) => {
                const ref = team.reflection;
                const hasFilledAny =
                  ref &&
                  (ref.r1r2Concern ||
                    ref.r3r4Cheating ||
                    ref.producerBenefit ||
                    ref.consumerBenefit ||
                    ref.governmentRole);

                return (
                  <div
                    key={team.id}
                    className="p-4 rounded-xl border border-slate-300 bg-white space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-xs"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.teamNumber}
                        </span>
                        <span className="font-bold text-sm text-slate-900">
                          第 {team.teamNumber} 組：{team.brandTag}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          （組員：{team.members || '全體組員'}）
                        </span>
                      </div>
                      <span className="font-mono font-bold text-amber-700">
                        總獲利：${team.totalProfit.toLocaleString()}
                      </span>
                    </div>

                    {!hasFilledAny ? (
                      <div className="text-slate-400 italic text-center py-2">
                        （該組尚未填答提交反思學習單）
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-800">
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <strong className="text-slate-900 block text-[11px]">
                            1. 不能溝通時（R1-R2）不敢開高價的顧慮：
                          </strong>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {ref.r1r2Concern || '未填寫'}
                          </p>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <strong className="text-slate-900 block text-[11px]">
                            2. 開放溝通後（R3-R4）若有人背叛的動機：
                          </strong>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {ref.r3r4Cheating || '未填寫'}
                          </p>
                        </div>

                        <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-200 space-y-1">
                          <strong className="text-amber-950 block text-[11px]">
                            3-(1) 甚麼情況生產者受益最大？
                          </strong>
                          <p className="text-slate-700 leading-relaxed">
                            {ref.producerBenefit || '未填寫'}
                          </p>
                        </div>

                        <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-200 space-y-1">
                          <strong className="text-blue-950 block text-[11px]">
                            3-(2) 甚麼情況消費者受益最大？
                          </strong>
                          <p className="text-slate-700 leading-relaxed">
                            {ref.consumerBenefit || '未填寫'}
                          </p>
                        </div>

                        <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-200 space-y-1 md:col-span-2">
                          <strong className="text-indigo-950 block text-[11px]">
                            3-(3) 政府要如何保障消費者受益最大？
                          </strong>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {ref.governmentRole || '未填寫'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Civics Key Concepts Summary */}
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 space-y-2 text-xs">
            <h3 className="font-bold text-amber-950 text-sm">💡 公民與社會微觀經濟學教學要旨：</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed">
              <li>
                <strong>卡特爾協議的不穩定性（Cartel Instability）：</strong>
                寡占市場中廠商追求自身利潤最大化的理性動機，將促使個別廠商偷降價以搶奪全部市場份額，導致聯合定價協議天然走向瓦解。
              </li>
              <li>
                <strong>囚徒困境的社會代價：</strong>
                缺乏信任與法律契約保障時，各方追求個人優勢策略（降價）可能導致全員獲利最低的割喉價格戰。
              </li>
              <li>
                <strong>公平交易法的管制必要性：</strong>
                《公平交易法》第 15
                條禁止事業之聯合行為，防止寡占廠商合謀抬價剝削消費者剩餘，維護市場自由競爭與公眾利益。
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-300 rounded-b-3xl flex justify-between items-center print:hidden">
          <div className="text-xs text-slate-500">
            可將此報告列印為紙本學習單，或選擇「另存為 PDF」存檔留存。
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportRoomDataToCSV(roomState)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>匯出 CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>列印 / 存為 PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
