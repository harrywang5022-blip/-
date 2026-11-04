import React, { useState, useEffect } from 'react';
import { PRESET_BRANDS } from '../utils/constants.ts';
import type { RoomState } from '../types/game.ts';
import { LocalRoomEngine } from '../utils/localSync.ts';
import { Users, Monitor, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  onJoinAsHost: (roomId: string) => void;
  onJoinAsTeam: (
    roomId: string,
    teamInfo: { teamNumber: number; name: string; members: string; brandTag: string }
  ) => void;
}

export const Lobby: React.FC<Props> = ({ onJoinAsHost, onJoinAsTeam }) => {
  // Read room query param from URL if student scanned QR code
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialRoom = urlParams?.get('room')?.toUpperCase() || '';

  const [tab, setTab] = useState<'JOIN' | 'HOST'>('JOIN');

  // Student join state
  const [roomCode, setRoomCode] = useState(initialRoom);
  const [teamNumber, setTeamNumber] = useState(1);
  const [members, setMembers] = useState('');
  const [selectedBrandIndex, setSelectedBrandIndex] = useState(0);
  const [roomPreview, setRoomPreview] = useState<RoomState | null>(null);
  const [userChangedTeamManually, setUserChangedTeamManually] = useState(false);

  // Host state
  const [hostRoomCode, setHostRoomCode] = useState(() => {
    return 'TP' + Math.floor(100 + Math.random() * 900);
  });

  // Query live room data when room code is entered
  useEffect(() => {
    const cleanRoom = roomCode.trim().toUpperCase();
    if (cleanRoom.length < 2) {
      setRoomPreview(null);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/rooms/${encodeURIComponent(cleanRoom)}`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .then((data: RoomState | null) => {
          const roomData = data && data.roomId ? data : LocalRoomEngine.getRoom(cleanRoom);
          if (roomData && roomData.roomId) {
            setRoomPreview(roomData);
            // If user hasn't explicitly chosen a team number, auto-select first available slot!
            if (!userChangedTeamManually && roomData.teams && roomData.teams.length > 0) {
              const taken = new Set(roomData.teams.map((t) => t.teamNumber));
              let firstFree = 1;
              while (taken.has(firstFree) && firstFree < 12) {
                firstFree++;
              }
              setTeamNumber(firstFree);
            }
          } else {
            setRoomPreview(null);
          }
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [roomCode, userChangedTeamManually]);

  const handleStudentJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    const brand = PRESET_BRANDS[selectedBrandIndex];
    onJoinAsTeam(roomCode.trim().toUpperCase(), {
      teamNumber,
      name: `第 ${teamNumber} 組 (${brand.name})`,
      members: members.trim() || `第 ${teamNumber} 組成員`,
      brandTag: brand.name,
    });
  };

  const handleHostCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostRoomCode.trim()) return;
    onJoinAsHost(hostRoomCode.trim().toUpperCase());
  };

  const occupiedTeam = roomPreview?.teams.find((t) => t.teamNumber === teamNumber);

  return (
    <div className="min-h-[calc(100vh-65px)] bg-gradient-to-b from-amber-50/60 via-orange-50/30 to-amber-100/40 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100/80 border border-amber-300 text-amber-900 text-xs font-bold shadow-xs">
            <span>🧻 台灣真實經濟歷史事件改編</span>
            <span className="w-1 h-1 rounded-full bg-amber-500" />
            <span>公民與社會・微觀經濟學遊戲</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
            安屎之亂
            <span className="block text-2xl sm:text-3xl text-amber-600 mt-1 font-extrabold">
              衛生紙價格策略賽局
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            回到 2018 年全台瘋狂囤積衛生紙的風暴現場！各組代表一家造紙廠商，
            在「禁止私下溝通」與「開放跨組協商」的情境下定價。
            你會守信協議開 450 元？還是偷偷背叛殺到 200 元獨吞全班訂單？
          </p>
        </div>

        {/* Main Tab Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-amber-200/90 overflow-hidden">
          {/* Tab buttons */}
          <div className="grid grid-cols-2 border-b border-slate-200">
            <button
              onClick={() => setTab('JOIN')}
              className={`py-4 px-6 text-sm sm:text-base font-black flex items-center justify-center gap-2 transition-all ${
                tab === 'JOIN'
                  ? 'bg-white text-amber-600 border-b-2 border-amber-600 shadow-xs'
                  : 'bg-slate-50 text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-5 h-5" />
              學生小組端（加入房間）
            </button>
            <button
              onClick={() => setTab('HOST')}
              className={`py-4 px-6 text-sm sm:text-base font-black flex items-center justify-center gap-2 transition-all ${
                tab === 'HOST'
                  ? 'bg-white text-amber-600 border-b-2 border-amber-600 shadow-xs'
                  : 'bg-slate-50 text-slate-500 hover:text-slate-800'
              }`}
            >
              <Monitor className="w-5 h-5" />
              教師主控端（大螢幕投影）
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {tab === 'JOIN' ? (
              /* Student Join Form */
              <form onSubmit={handleStudentJoin} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-bold text-slate-800">
                      1. 教室房間代碼 (Room Code)
                    </label>
                    {roomPreview && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        已連線教室，目前 {roomPreview.teams.length} 組已加入
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="請輸入黑板上顯示的房間代碼 (例如: TP88)"
                    className="w-full text-lg font-mono font-bold tracking-wider px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-hidden transition-all uppercase"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">
                      2. 選擇小組組別
                    </label>
                    <select
                      value={teamNumber}
                      onChange={(e) => {
                        setTeamNumber(Number(e.target.value));
                        setUserChangedTeamManually(true);
                      }}
                      className="w-full text-base font-bold px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-hidden"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                        const existing = roomPreview?.teams.find((t) => t.teamNumber === num);
                        return (
                          <option key={num} value={num}>
                            第 {num} 組 {existing ? `(${existing.brandTag} - 已就位)` : '（空位可選）'}
                          </option>
                        );
                      })}
                    </select>

                    {occupiedTeam && (
                      <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-1.5 leading-snug">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          第 {teamNumber} 組已由同學建立（{occupiedTeam.brandTag}）。若你們是同組同學，加入後將共用此組身分與出價！
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">
                      3. 小組成員姓名
                    </label>
                    <input
                      type="text"
                      value={members}
                      onChange={(e) => setMembers(e.target.value)}
                      placeholder="例如: 王小明、林大同、陳小花"
                      className="w-full text-sm px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Brand selection */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">
                    4. 代表衛生紙品牌
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {PRESET_BRANDS.map((brand, idx) => {
                      const isSelected = selectedBrandIndex === idx;
                      return (
                        <button
                          key={brand.name}
                          type="button"
                          onClick={() => setSelectedBrandIndex(idx)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50/80 shadow-sm scale-102 ring-2 ring-amber-300'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xl mb-1">{brand.icon}</div>
                          <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {brand.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {brand.badge}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-amber-600 hover:bg-amber-700 active:scale-99 text-white font-black text-lg rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                >
                  進入房間開始定價
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            ) : (
              /* Teacher Host Form */
              <form onSubmit={handleHostCreate} className="space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <Monitor className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-950 text-sm">教師主控大螢幕模式</h4>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      建立房間後，將此畫面投影至班級黑板或觸控大屏。畫面會生成專屬 QR Code 與房間代碼，學生直接拿起載具連線參與。
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1.5">
                    設定房間代碼 (Room Code)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={hostRoomCode}
                    onChange={(e) => setHostRoomCode(e.target.value.toUpperCase())}
                    placeholder="例如: TP2018"
                    className="w-full text-xl font-mono font-black tracking-widest px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-hidden transition-all uppercase"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    學生連線時只需輸入此 4~6 碼代碼，即可直接加入！
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                  <div className="font-bold text-slate-800 mb-1">🎮 標準回合配置說明：</div>
                  <div>・第 1–2 回合（獨立決策）：🚫 禁止組間溝通，體驗資訊不對稱與囚徒困境猜忌。</div>
                  <div>・第 3–4 回合（開放協商）：💬 廠商面對面討論定價，考驗誠信、卡特爾協議與背叛。</div>
                  <div>・第 5 階段（反思討論）：全班投影線上討論單，深入《公平交易法》與市場秩序。</div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-amber-600 hover:bg-amber-700 active:scale-99 text-white font-black text-lg rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                >
                  建立教室房間並啟動投影
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Civics Rule summary grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm text-slate-700">
          <div className="p-4 bg-white/80 rounded-2xl border border-amber-200 shadow-xs">
            <div className="font-black text-slate-900 text-base mb-1 flex items-center gap-1.5">
              <span>🛒</span>
              <span>消費者唯一原則</span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              衛生紙品質無顯著差異，消費者<strong>只會購買全場最低價</strong>。開高者哪怕只差 50 元，訂單直接歸零！
            </p>
          </div>

          <div className="p-4 bg-white/80 rounded-2xl border border-amber-200 shadow-xs">
            <div className="font-black text-slate-900 text-base mb-1 flex items-center gap-1.5">
              <span>🤝</span>
              <span>平分與獨吞規則</span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              若只有一家最低價，<strong>獨得 1200 箱所有訂單</strong>！若多家同為最低價，則<strong>平均瓜分市場訂單</strong>。
            </p>
          </div>

          <div className="p-4 bg-white/80 rounded-2xl border border-amber-200 shadow-xs">
            <div className="font-black text-slate-900 text-base mb-1 flex items-center gap-1.5">
              <span>⚖️</span>
              <span>公平交易與納許均衡</span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              全員 450 元＝卡特爾暴利；全員 200 元＝價格戰做白工；個別背叛＝刺客暴賺。考驗人性與法律邊界！
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
