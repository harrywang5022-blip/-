import React from 'react';
import { AlertTriangle, ShieldCheck, LogOut, ArrowLeft } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onCancel: () => void;
  onConfirmLeave: () => void;
  role: 'HOST' | 'TEAM' | 'LOBBY';
  roomId?: string;
}

export const LeaveConfirmModal: React.FC<Props> = ({
  isOpen,
  onCancel,
  onConfirmLeave,
  role,
  roomId,
}) => {
  if (!isOpen) return null;

  const isStudent = role === 'TEAM';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border-2 border-amber-300 text-slate-900 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-700">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-black text-slate-900">
            {isStudent ? '確定要離開目前房間嗎？' : '確定要退出房間大螢幕？'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {isStudent
              ? `你目前正在房間【${roomId || ''}】進行衛生紙價格策略賽局。若離開房間，你將中斷與黑板的即時出價與大螢幕連線！`
              : `退出後大螢幕將返回大廳首頁。`}
          </p>
        </div>

        {isStudent && (
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>防誤觸保護提醒：</span>
            </div>
            <div>
              若是不小心滑動或點擊到，請點擊下方的<strong>「繼續留在遊戲」</strong>即可安全返回。
            </div>
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          {/* Primary Action: Stay in Game (prominent) */}
          <button
            onClick={onCancel}
            className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>繼續留在遊戲（取消離開）</span>
          </button>

          {/* Destructive Action: Confirm Leave (de-emphasized) */}
          <button
            onClick={onConfirmLeave}
            className="w-full py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>確定離開房間並返回首頁</span>
          </button>
        </div>
      </div>
    </div>
  );
};
