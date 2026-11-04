import React, { useState } from 'react';
import type { Team, TeamReflection } from '../types/game.ts';
import { FileText, Send, Printer, Copy, Check, X, Shield, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  team: Team;
  allTeams?: Team[];
  onSubmitReflection: (reflection: TeamReflection) => void;
  readOnly?: boolean;
}

export const WorksheetModal: React.FC<Props> = ({
  isOpen,
  onClose,
  team,
  allTeams = [],
  onSubmitReflection,
  readOnly = false,
}) => {
  const [reflection, setReflection] = useState<TeamReflection>(() => ({
    r1r2Concern:
      team.reflection?.r1r2Concern ||
      '害怕其他組開低價搶走所有訂單，若我們開 450 元將完全賣不掉，導致銷量與利潤為 0。',
    r3r4Cheating:
      team.reflection?.r3r4Cheating ||
      '大家口頭上協議好開 450 元，但只要有人偷偷開 400 或 200，就能一人獨吞 1200 箱市場，獲得巨大利潤誘惑！',
    producerBenefit:
      team.reflection?.producerBenefit ||
      '所有廠商達成一致協議且都不背叛，全員開出 450 元時，生產者利潤最大化（瓜分高額毛利）。',
    consumerBenefit:
      team.reflection?.consumerBenefit ||
      '廠商陷入劇烈價格競爭，全員開出 200 元保本底價時，消費者受益最大（買到最便宜衛生紙）。',
    governmentRole:
      team.reflection?.governmentRole ||
      '政府主管機關（如公平交易委員會）依《公平交易法》嚴查事業間的「聯合行為（卡特爾）」、禁止不實散布漲價謠言與哄抬物價，維持自由競爭以保護消費者權益。',
  }));

  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleTextChange = (field: keyof TeamReflection, val: string) => {
    if (readOnly) return;
    setReflection((prev) => ({ ...prev, [field]: val }));
  };

  const handleSaveAndSend = () => {
    onSubmitReflection(reflection);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const text = `【安屎之亂：衛生紙價格策略賽局 小組討論與紀錄單】
組別：第 ${team.teamNumber} 組 (${team.brandTag})
組員：${team.members || '未填寫'}
累計總利潤：$${team.totalProfit.toLocaleString()} | 總銷量：${team.totalSoldUnits} 箱

一、回合決策紀錄表：
${[1, 2, 3, 4]
  .map((r) => {
    const res = team.roundHistory.find((h) => h.round === r);
    const comm = r <= 2 ? '🚫 禁止溝通' : '💬 開放協商';
    const bid = res ? `${res.bid} 元` : '未進行';
    const agreed = r <= 2 ? '無' : res?.agreedPrice ? `${res.agreedPrice} 元` : '450 元 (協議)';
    const result = res
      ? res.isWinner
        ? `勝！售出 ${res.unitsSold} 箱，獲利 $${res.profit.toLocaleString()}`
        : '負 (銷量 0 箱，獲利 $0)'
      : '-';
    return `R${r} [${comm}] 本組報價: ${bid} | 協議價: ${agreed} | 結果: ${result}`;
  })
  .join('\n')}

二、核心討論與反思：
1. 不能溝通時（R1-R2）：我們不敢開高價（450元）的主要顧慮是什麼？
答：${reflection.r1r2Concern}

2. 開放溝通後（R3-R4）：各組有遵守協議嗎？若有人背叛（偷偷降價），動機是什麼？
答：${reflection.r3r4Cheating}

3. 甚麼情況生產者受益最大？
答：${reflection.producerBenefit}

4. 甚麼情況消費者受益最大？
答：${reflection.consumerBenefit}

5. 政府要如何保障消費者受益最大？
答：${reflection.governmentRole}
`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-amber-300 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-white rounded-t-2xl shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                價格策略賽局：小組討論與紀錄單
              </h2>
              <p className="text-xs text-amber-100">
                公民與社會科・市場競爭與消費者保護專題
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              title="列印或另存 PDF"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1 text-xs"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">列印學習單</span>
            </button>
            <button
              onClick={handleCopyText}
              title="複製全文"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1 text-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? '已複製' : '複製文字'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-slate-800 printable-area">
          {/* Group Info Header Bar */}
          <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-900">組別：</span>
              <span className="px-2.5 py-1 bg-white font-black text-amber-800 rounded border border-amber-300">
                第 {team.teamNumber} 組 ({team.brandTag})
              </span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="font-bold text-amber-900">組員：</span>
              <span className="px-2.5 py-1 bg-white text-slate-700 rounded border border-amber-200 font-medium">
                {team.members || '全體組員'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">
                總獲利：${team.totalProfit.toLocaleString()}
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold">
                總銷量：{team.totalSoldUnits} 箱
              </span>
            </div>
          </div>

          {/* Table: 回合決策紀錄表 */}
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                一
              </span>
              回合決策紀錄表
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 text-center">回合</th>
                    <th className="px-3 py-2.5">溝通規則</th>
                    <th className="px-3 py-2.5">本組決策價格</th>
                    <th className="px-3 py-2.5">跨組協議價</th>
                    <th className="px-3 py-2.5">其他組開價</th>
                    <th className="px-3 py-2.5">勝負 / 獲利結果</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[1, 2, 3, 4].map((r) => {
                    const result = team.roundHistory.find((h) => h.round === r);
                    const isNoComm = r <= 2;

                    // Other teams bids
                    const otherBids = result
                      ? Object.entries(result.allBids)
                          .filter(([id]) => id !== team.id)
                          .map(([_, bid]) => `${bid}元`)
                          .join(', ')
                      : '-';

                    return (
                      <tr
                        key={r}
                        className={result?.isWinner ? 'bg-amber-50/50' : 'hover:bg-slate-50/60'}
                      >
                        <td className="px-3 py-3 font-black text-slate-900 text-center bg-slate-50">
                          R{r}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                              isNoComm
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isNoComm ? '🚫 禁止溝通' : '💬 開放協商'}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold">
                          {result ? (
                            <span
                              className={`px-2 py-0.5 rounded ${
                                result.bid === 450
                                  ? 'bg-blue-100 text-blue-800'
                                  : result.bid === 400
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {result.bid} 元
                            </span>
                          ) : (
                            <div className="flex gap-1.5 text-xs text-slate-400">
                              <span>[ ]450</span>
                              <span>[ ]400</span>
                              <span>[ ]200</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {isNoComm
                            ? '無'
                            : result?.agreedPrice
                            ? `${result.agreedPrice} 元`
                            : '______ 元'}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 font-mono">
                          {otherBids || '尚無紀錄'}
                        </td>
                        <td className="px-3 py-3">
                          {result ? (
                            result.isWinner ? (
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                🏆 得標！賣出 {result.unitsSold} 箱 (+$
                                {result.profit.toLocaleString()})
                              </span>
                            ) : (
                              <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                ❌ 未中標 (賣 0 箱，獲利 $0)
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">尚未結算</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: 核心討論與反思 */}
          <div className="space-y-5">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                二
              </span>
              核心討論與反思
            </h3>

            {/* Q1 */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-sm font-bold text-slate-900">
                1. 不能溝通時（R1-R2）：我們不敢開高價（450元）的主要顧慮是什麼？
              </label>
              <textarea
                value={reflection.r1r2Concern}
                onChange={(e) => handleTextChange('r1r2Concern', e.target.value)}
                rows={2}
                disabled={readOnly}
                placeholder="請輸入小組思考..."
                className="w-full text-xs sm:text-sm p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            {/* Q2 */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-sm font-bold text-slate-900">
                2. 開放溝通後（R3-R4）：各組有遵守協議嗎？若有人背叛（偷偷降價），動機是什麼？
              </label>
              <textarea
                value={reflection.r3r4Cheating}
                onChange={(e) => handleTextChange('r3r4Cheating', e.target.value)}
                rows={2}
                disabled={readOnly}
                placeholder="請描述跨組協商時的情形與動機..."
                className="w-full text-xs sm:text-sm p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            {/* Q3: Three sub-questions */}
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3">
              <label className="block text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                3. 公民與經濟學延伸深思
              </label>

              <div className="space-y-3 text-xs sm:text-sm">
                <div>
                  <span className="font-bold text-slate-800 block mb-1">
                    (1) 甚麼情況生產者受益最大？
                  </span>
                  <input
                    type="text"
                    value={reflection.producerBenefit}
                    onChange={(e) => handleTextChange('producerBenefit', e.target.value)}
                    disabled={readOnly}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <span className="font-bold text-slate-800 block mb-1">
                    (2) 甚麼情況消費者受益最大？
                  </span>
                  <input
                    type="text"
                    value={reflection.consumerBenefit}
                    onChange={(e) => handleTextChange('consumerBenefit', e.target.value)}
                    disabled={readOnly}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <span className="font-bold text-slate-800 block mb-1">
                    (3) 政府要如何保障消費者受益最大？（例如公平交易法、聯合行為之規範）
                  </span>
                  <textarea
                    rows={2}
                    value={reflection.governmentRole}
                    onChange={(e) => handleTextChange('governmentRole', e.target.value)}
                    disabled={readOnly}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {submitted ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> 已同步傳送至老師大螢幕反思牆！
              </span>
            ) : (
              <span>填寫完畢後請點擊右方送出，老師可在投影幕即時展示！</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <button
                onClick={handleSaveAndSend}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 text-sm"
              >
                <Send className="w-4 h-4" />
                送出學習單至大螢幕
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors text-sm"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
