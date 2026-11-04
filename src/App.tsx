import React, { useEffect, useState } from 'react';
import { useGameSocket } from './hooks/useGameSocket.ts';
import { Header } from './components/Header.tsx';
import { Lobby } from './components/Lobby.tsx';
import { HostScreen } from './components/HostScreen.tsx';
import { TeamScreen } from './components/TeamScreen.tsx';

export default function App() {
  const [role, setRole] = useState<'LOBBY' | 'HOST' | 'TEAM'>('LOBBY');

  const {
    isConnected,
    roomState,
    myTeam,
    lastError,
    joinAsHost,
    joinAsTeam,
    submitBid,
    submitReflection,
    hostStartRound,
    hostForceReveal,
    hostNextPhase,
    hostAddAI,
    hostReset,
    hostKickTeam,
    hostSetTeamBid,
    hostStartTimer,
    hostPauseTimer,
  } = useGameSocket();

  // Session persistence key
  const SESSION_KEY = 'civics_active_session_v1';

  // Restore session on initial mount if available
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.role === 'TEAM' && parsed.roomId && parsed.teamInfo) {
          joinAsTeam(parsed.roomId, parsed.teamInfo);
          setRole('TEAM');
        } else if (parsed.role === 'HOST' && parsed.roomId) {
          joinAsHost(parsed.roomId);
          setRole('HOST');
        }
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
  }, [joinAsTeam, joinAsHost]);

  // Prevent accidental page leave / reload with beforeunload
  useEffect(() => {
    if (role === 'LOBBY') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '您正在遊戲進行中，確定要離開嗎？';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [role]);

  // Check URL query parameters for auto room join (?room=TP88)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const roleParam = params.get('role');

    if (roomParam) {
      if (roleParam === 'host') {
        joinAsHost(roomParam.toUpperCase());
        setRole('HOST');
        try {
          sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ role: 'HOST', roomId: roomParam.toUpperCase() })
          );
        } catch {}
      }
    }
  }, [joinAsHost]);

  const handleJoinAsHost = (roomId: string) => {
    joinAsHost(roomId);
    setRole('HOST');
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role: 'HOST', roomId }));
    } catch {}
  };

  const handleJoinAsTeam = (
    roomId: string,
    teamInfo: { teamNumber: number; name: string; members: string; brandTag: string }
  ) => {
    joinAsTeam(roomId, teamInfo);
    setRole('TEAM');
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ role: 'TEAM', roomId, teamInfo })
      );
    } catch {}
  };

  const handleExit = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    setRole('LOBBY');
    window.location.href = window.location.pathname;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        role={role}
        roomId={roomState?.roomId}
        roomName={roomState?.roomName}
        roundNumber={roomState?.currentRound}
        totalRounds={roomState?.totalRounds}
        isConnected={isConnected}
        onExit={role !== 'LOBBY' ? handleExit : undefined}
      />

      {lastError && (
        <div className="bg-rose-500 text-white text-xs font-bold px-4 py-2 text-center shadow-md">
          連線提示：{lastError}
        </div>
      )}

      <main className="flex-1">
        {role === 'LOBBY' || !roomState ? (
          <Lobby
            onJoinAsHost={handleJoinAsHost}
            onJoinAsTeam={handleJoinAsTeam}
          />
        ) : role === 'HOST' ? (
          <HostScreen
            roomState={roomState}
            onStartRound={hostStartRound}
            onForceReveal={hostForceReveal}
            onNextPhase={hostNextPhase}
            onAddAI={hostAddAI}
            onReset={hostReset}
            onKickTeam={hostKickTeam}
            onSetTeamBid={hostSetTeamBid}
            onStartTimer={hostStartTimer}
            onPauseTimer={hostPauseTimer}
          />
        ) : myTeam ? (
          <TeamScreen
            roomState={roomState}
            team={myTeam}
            onSubmitBid={submitBid}
            onSubmitReflection={submitReflection}
          />
        ) : (
          <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-lg font-bold text-slate-800">正在同步小組資訊...</div>
            <p className="text-xs text-slate-500">已連線房間，正在載入您的小組控制台</p>
            <button
              onClick={handleExit}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-sm font-bold transition-all shadow-xs"
            >
              返回重新選擇組別
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
