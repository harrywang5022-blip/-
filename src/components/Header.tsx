import React, { useState } from 'react';
import { Volume2, VolumeX, BookOpen, Users, HelpCircle, RefreshCw } from 'lucide-react';
import { sound } from '../utils/audio.ts';
import { CivicsHistoryModal } from './CivicsHistoryModal.tsx';

interface Props {
  role: 'HOST' | 'TEAM' | 'LOBBY';
  roomId?: string;
  roomName?: string;
  roundNumber?: number;
  totalRounds?: number;
  isConnected: boolean;
  onExit?: () => void;
}

export const Header: React.FC<Props> = ({
  role,
  roomId,
  roomName,
  roundNumber,
  totalRounds = 4,
  isConnected,
  onExit,
}) => {
  const [soundOn, setSoundOn] = useState(sound.isEnabled());
  const [showHistory, setShowHistory] = useState(false);

  const toggleSound = () => {
    const next = !soundOn;
    sound.setEnabled(next);
    setSoundOn(next);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-amber-200/80 shadow-xs px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & App title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white text-xl shadow-md shrink-0">
              🧻
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg md:text-xl text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>安屎之亂</span>
                  <span className="text-xs md:text-sm font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    衛生紙價格賽局
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                公民課專用・寡占市場與囚徒困境互動連線模擬
              </p>
            </div>
          </div>

          {/* Center Info: Round status */}
          {roomId && roundNumber !== undefined && (
            <div className="hidden md:flex items-center gap-3 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200 text-xs font-bold text-amber-900">
              <span>房間：{roomId}</span>
              <span className="w-1 h-1 rounded-full bg-amber-400" />
              <span>
                回合：R{roundNumber} / {totalRounds}
              </span>
              <span className="w-1 h-1 rounded-full bg-amber-400" />
              <span>
                {roundNumber <= 2 ? '🚫 禁止溝通' : '💬 開放協商'}
              </span>
            </div>
          )}

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Connection badge */}
            <div
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span className="hidden sm:inline">
                {isConnected ? '已連線' : '連線中...'}
              </span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              title={soundOn ? '靜音' : '開啟音效'}
              className="p-2 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 border border-slate-200 transition-colors"
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Civics History & Concept */}
            <button
              onClick={() => setShowHistory(true)}
              title="查看安屎之亂歷史與公民知識"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">歷史事件簿</span>
            </button>

            {onExit && (
              <button
                onClick={onExit}
                className="text-xs text-slate-500 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                退出房間
              </button>
            )}
          </div>
        </div>
      </header>

      <CivicsHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </>
  );
};
