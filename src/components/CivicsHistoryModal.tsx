import React from 'react';
import { CIVICS_HISTORY } from '../utils/constants.ts';
import { X, BookOpen, AlertTriangle, ShieldCheck, Scale, Award } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CivicsHistoryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-amber-200">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-amber-500 text-white rounded-t-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <h2 className="text-xl font-bold tracking-wide">公民課堂小百科：2018 台灣安屎之亂</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-amber-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-slate-800">
          {/* Historical intro */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex gap-4 items-start">
            <span className="text-3xl">🧻</span>
            <div>
              <h3 className="text-lg font-bold text-amber-900 mb-1">
                衛生紙搶購狂潮（俗稱安屎之亂）
              </h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                {CIVICS_HISTORY.summary}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              歷史大事紀（2018年2月至3月）
            </h4>
            <div className="space-y-2 border-l-2 border-amber-300 pl-4 ml-2">
              {CIVICS_HISTORY.timeline.map((item, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-amber-500 border-2 border-white ring-2 ring-amber-200" />
                  <span className="inline-block text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded mb-0.5">
                    {item.date}
                  </span>
                  <p className="text-sm text-slate-700">{item.event}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Civics Concepts */}
          <div>
            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
              <Scale className="w-5 h-5 text-indigo-600" />
              公民課必備經濟學核心概念
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CIVICS_HISTORY.concepts.map((concept, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <h5 className="font-bold text-indigo-900 text-sm mb-1">{concept.name}</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">{concept.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Fair trade act highlight */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <h4 className="font-bold text-emerald-900 flex items-center gap-2 text-sm mb-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              政府如何保障消費者權益？
            </h4>
            <ul className="text-xs text-emerald-800 space-y-1.5 list-disc pl-5 leading-relaxed">
              <li>
                <strong>《公平交易法》第14條（禁止聯合行為）</strong>：嚴禁廠商私下約定價格、配額或協議共同調漲，以杜絕卡特爾暴利。
              </li>
              <li>
                <strong>《公平交易法》第25條（足以影響交易秩序之欺罔行為）</strong>：禁止事業散布不實調漲消息藉此促銷與操弄民眾恐慌。2018年公平會即依法對帶頭業者開罰350萬元。
              </li>
              <li>
                <strong>行政院消保處與消基會</strong>：啟動各賣場查價、穩定民生物資供應鏈，防止囤積居奇與哄抬物價。
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 rounded-b-2xl border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
          >
            我知道了，返回遊戲
          </button>
        </div>
      </div>
    </div>
  );
};
