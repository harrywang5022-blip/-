import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BidPrice,
  RoomState,
  Team,
  TeamReflection,
  WSClientMessage,
  WSServerMessage,
} from '../types/game.ts';
import { sound } from '../utils/audio.ts';
import { LocalRoomEngine } from '../utils/localSync.ts';
import { PeerSyncEngine } from '../utils/peerSync.ts';

export function useGameSocket() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStaticMode, setIsStaticMode] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectionNote, setConnectionNote] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const pendingJoinRef = useRef<WSClientMessage | null>(null);
  const isHostRef = useRef<boolean>(false);

  // Initialize Local sync engine for cross-tab sync
  useEffect(() => {
    LocalRoomEngine.init();
    const unsub = LocalRoomEngine.subscribe((updatedRoom) => {
      if (currentRoomIdRef.current && updatedRoom.roomId === currentRoomIdRef.current) {
        setRoomState({ ...updatedRoom });
        setIsConnected(true);
      }
    });

    PeerSyncEngine.onStatusChange((status) => {
      if (status.details) {
        setConnectionNote(status.details);
      }
      if (status.connected) {
        setIsConnected(true);
      }
    });

    return () => {
      unsub();
      PeerSyncEngine.destroy();
    };
  }, []);

  const handleIncomingServerMessage = useCallback((msg: WSServerMessage) => {
    switch (msg.type) {
      case 'ROOM_STATE':
        setRoomState(msg.state);
        setIsConnected(true);
        if (msg.yourTeamId) {
          setMyTeamId(msg.yourTeamId);
        }
        break;

      case 'REVEAL_EFFECT':
        sound.playGong();
        if (msg.minPrice === 200) {
          sound.playBuzzer();
        } else {
          sound.playCash();
        }
        break;

      case 'TIMER_TICK':
        setRoomState((prev) =>
          prev ? { ...prev, negotiationSecondsRemaining: msg.seconds } : null
        );
        break;

      case 'ERROR':
        setLastError(msg.message);
        break;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setLastError(null);

        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 15000);

        if (pendingJoinRef.current) {
          ws.send(JSON.stringify(pendingJoinRef.current));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSServerMessage;
          handleIncomingServerMessage(msg);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      };

      ws.onerror = () => {
        // WebSocket not available (expected on static deployments like Vercel)
        setIsStaticMode(true);
      };
    } catch {
      setIsStaticMode(true);
    }
  }, [handleIncomingServerMessage]);

  // Initial connection probe on mount
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeoutId);
        if (res.ok) {
          setIsConnected(true);
          setIsStaticMode(false);
          connectWebSocket();
        } else {
          setIsStaticMode(true);
          setIsConnected(true);
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setIsStaticMode(true);
        setIsConnected(true);
      });

    return () => {
      clearTimeout(timeoutId);
    };
  }, [connectWebSocket]);

  const sendWSMessage = useCallback((msg: WSClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      if (msg.type === 'JOIN_HOST' || msg.type === 'JOIN_TEAM') {
        pendingJoinRef.current = msg;
      }
    }
  }, []);

  const joinAsHost = useCallback(
    (roomId: string) => {
      const cleanRoom = roomId.trim().toUpperCase();
      currentRoomIdRef.current = cleanRoom;
      isHostRef.current = true;

      // Always initialize or load local room state
      const initialRoom = LocalRoomEngine.getOrCreateRoom(cleanRoom);
      setRoomState(initialRoom);
      setIsConnected(true);

      // Start WebRTC Peer Host for cross-device synchronization (works on Vercel, Netlify, GitHub Pages)
      PeerSyncEngine.startHost(cleanRoom, (updatedState) => {
        setRoomState({ ...updatedState });
        setIsConnected(true);
      });

      // Also try WebSocket / API if running with persistent backend
      if (!isStaticMode) {
        const msg: WSClientMessage = { type: 'JOIN_HOST', roomId: cleanRoom };
        pendingJoinRef.current = msg;
        connectWebSocket();
        sendWSMessage(msg);

        fetch(`/api/rooms/${encodeURIComponent(cleanRoom)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: RoomState | null) => {
            if (data && data.roomId) {
              setRoomState(data);
              setIsConnected(true);
            }
          })
          .catch(() => {});
      }
    },
    [connectWebSocket, sendWSMessage, isStaticMode]
  );

  const joinAsTeam = useCallback(
    (
      roomId: string,
      teamInfo: { teamId?: string; teamNumber: number; name: string; members: string; brandTag: string }
    ) => {
      const cleanRoom = roomId.trim().toUpperCase();
      currentRoomIdRef.current = cleanRoom;
      isHostRef.current = false;

      // Maintain persistent teamId in sessionStorage
      const storageKey = `civics_team_id_${cleanRoom}_n${teamInfo.teamNumber}`;
      let assignedTeamId = teamInfo.teamId;
      if (!assignedTeamId && typeof window !== 'undefined') {
        assignedTeamId = window.sessionStorage.getItem(storageKey) || undefined;
      }
      if (!assignedTeamId) {
        assignedTeamId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(storageKey, assignedTeamId);
          window.sessionStorage.setItem(`civics_last_team_num_${cleanRoom}`, String(teamInfo.teamNumber));
        }
      } else if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(`civics_last_team_num_${cleanRoom}`, String(teamInfo.teamNumber));
      }

      const fullTeamInfo = { ...teamInfo, teamId: assignedTeamId };
      setMyTeamId(assignedTeamId);

      // Local registration for instant UI feedback
      const localRes = LocalRoomEngine.joinTeam(cleanRoom, fullTeamInfo);
      setRoomState(localRes.room);
      setIsConnected(true);

      const joinMsg: WSClientMessage = { type: 'JOIN_TEAM', roomId: cleanRoom, teamInfo: fullTeamInfo };
      pendingJoinRef.current = joinMsg;

      // Start WebRTC Peer Client to sync with Teacher's host screen across physical devices (Vercel)
      PeerSyncEngine.startClient(cleanRoom, handleIncomingServerMessage, joinMsg);

      // Also try WebSocket / API in full-stack mode
      if (!isStaticMode) {
        connectWebSocket();
        sendWSMessage(joinMsg);

        fetch(`/api/rooms/${encodeURIComponent(cleanRoom)}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamInfo: fullTeamInfo }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.team) {
              setMyTeamId(data.team.id);
              setRoomState(data.room);
              setIsConnected(true);
            }
          })
          .catch(() => {});
      }
    },
    [connectWebSocket, sendWSMessage, isStaticMode, handleIncomingServerMessage]
  );

  const submitBid = useCallback(
    (bid: BidPrice, agreedPrice?: number) => {
      if (!roomState || !myTeamId) return;
      const roomId = roomState.roomId;

      // Update local state immediately
      const updated = LocalRoomEngine.submitBid(roomId, myTeamId, bid, agreedPrice);
      setRoomState(updated);
      sound.playPop();

      const msg: WSClientMessage = {
        type: 'SUBMIT_BID',
        roomId,
        teamId: myTeamId,
        bid,
        agreedPrice,
      };

      // Send via WebRTC DataChannel to Teacher's screen
      PeerSyncEngine.sendFromClient(msg);

      // Send via WebSocket / API
      if (!isStaticMode) {
        sendWSMessage(msg);
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/bid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: myTeamId, bid, agreedPrice }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.room) {
              setRoomState(data.room);
            }
          })
          .catch(() => {});
      }
    },
    [roomState, myTeamId, sendWSMessage, isStaticMode]
  );

  const submitReflection = useCallback(
    (reflection: TeamReflection) => {
      if (!roomState || !myTeamId) return;
      const roomId = roomState.roomId;

      // Update local state
      const updated = LocalRoomEngine.submitReflection(roomId, myTeamId, reflection);
      setRoomState(updated);

      const msg: WSClientMessage = {
        type: 'SUBMIT_REFLECTION',
        roomId,
        teamId: myTeamId,
        reflection,
      };

      // Send via WebRTC to Teacher's screen
      PeerSyncEngine.sendFromClient(msg);

      if (!isStaticMode) {
        sendWSMessage(msg);
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/reflection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: myTeamId, reflection }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.room) {
              setRoomState(data.room);
            }
          })
          .catch(() => {});
      }
    },
    [roomState, myTeamId, sendWSMessage, isStaticMode]
  );

  const hostStartRound = useCallback(
    (round: number) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      const updated = LocalRoomEngine.startRound(roomId, round);
      setRoomState(updated);

      // Broadcast to all student devices via WebRTC
      PeerSyncEngine.broadcastToAllStudents({
        type: 'ROOM_STATE',
        state: updated,
      });

      if (!isStaticMode) {
        sendWSMessage({ type: 'HOST_START_ROUND', roomId, round });
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/start-round`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ round }),
        }).catch(() => {});
      }
    },
    [roomState, sendWSMessage, isStaticMode]
  );

  const hostForceReveal = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;

    sound.playDrumRoll();
    const updated = LocalRoomEngine.settleRound(roomId);
    setRoomState(updated);

    // Broadcast to all student devices via WebRTC
    PeerSyncEngine.broadcastToAllStudents({
      type: 'ROOM_STATE',
      state: updated,
    });

    if (!isStaticMode) {
      sendWSMessage({ type: 'HOST_FORCE_REVEAL', roomId });
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/force-reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
  }, [roomState, sendWSMessage, isStaticMode]);

  const hostNextPhase = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;

    const updated = LocalRoomEngine.nextPhase(roomId);
    setRoomState(updated);

    PeerSyncEngine.broadcastToAllStudents({
      type: 'ROOM_STATE',
      state: updated,
    });

    if (!isStaticMode) {
      sendWSMessage({ type: 'HOST_NEXT_PHASE', roomId });
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/next-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
  }, [roomState, sendWSMessage, isStaticMode]);

  const hostAddAI = useCallback(
    (count = 2) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      const updated = LocalRoomEngine.addAI(roomId, count);
      setRoomState(updated);

      PeerSyncEngine.broadcastToAllStudents({
        type: 'ROOM_STATE',
        state: updated,
      });

      if (!isStaticMode) {
        sendWSMessage({ type: 'HOST_ADD_AI_TEAMS', roomId, count });
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/add-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count }),
        }).catch(() => {});
      }
    },
    [roomState, sendWSMessage, isStaticMode]
  );

  const hostReset = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;

    const updated = LocalRoomEngine.reset(roomId);
    setRoomState(updated);

    PeerSyncEngine.broadcastToAllStudents({
      type: 'ROOM_STATE',
      state: updated,
    });

    if (!isStaticMode) {
      sendWSMessage({ type: 'HOST_RESET_GAME', roomId });
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
  }, [roomState, sendWSMessage, isStaticMode]);

  const hostKickTeam = useCallback(
    (teamId: string) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      const updated = LocalRoomEngine.kickTeam(roomId, teamId);
      setRoomState(updated);

      PeerSyncEngine.broadcastToAllStudents({
        type: 'ROOM_STATE',
        state: updated,
      });

      if (!isStaticMode) {
        sendWSMessage({ type: 'HOST_KICK_TEAM', roomId, teamId });
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/kick-team`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId }),
        }).catch(() => {});
      }
    },
    [roomState, sendWSMessage, isStaticMode]
  );

  const hostSetTeamBid = useCallback(
    (teamId: string, bid: BidPrice, agreedPrice?: number) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      const updated = LocalRoomEngine.submitBid(roomId, teamId, bid, agreedPrice);
      setRoomState(updated);
      sound.playPop();

      PeerSyncEngine.broadcastToAllStudents({
        type: 'ROOM_STATE',
        state: updated,
      });

      if (!isStaticMode) {
        sendWSMessage({ type: 'HOST_SET_TEAM_BID', roomId, teamId, bid, agreedPrice });
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/set-team-bid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId, bid, agreedPrice }),
        }).catch(() => {});
      }
    },
    [roomState, sendWSMessage, isStaticMode]
  );

  const hostStartTimer = useCallback(
    (seconds = 90) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      const room = LocalRoomEngine.getOrCreateRoom(roomId);
      room.negotiationSecondsRemaining = seconds;
      room.isTimerRunning = true;
      LocalRoomEngine.saveRoom(room);
      setRoomState({ ...room });

      PeerSyncEngine.broadcastToAllStudents({
        type: 'TIMER_TICK',
        seconds,
      });

      if (!isStaticMode) {
        sendWSMessage({ type: 'HOST_START_TIMER', roomId, seconds });
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/timer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', seconds }),
        }).catch(() => {});
      }
    },
    [roomState, sendWSMessage, isStaticMode]
  );

  const hostPauseTimer = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;

    const room = LocalRoomEngine.getOrCreateRoom(roomId);
    room.isTimerRunning = false;
    LocalRoomEngine.saveRoom(room);
    setRoomState({ ...room });

    if (!isStaticMode) {
      sendWSMessage({ type: 'HOST_PAUSE_TIMER', roomId });
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      }).catch(() => {});
    }
  }, [roomState, sendWSMessage, isStaticMode]);

  // Polling fallback when running full-stack backend
  useEffect(() => {
    if (isStaticMode) return;

    const pollInterval = setInterval(() => {
      if (currentRoomIdRef.current) {
        fetch(`/api/rooms/${encodeURIComponent(currentRoomIdRef.current)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: RoomState | null) => {
            if (data && data.roomId) {
              setIsConnected(true);
              setRoomState((prev) => {
                if (!prev) return data;
                const prevSubmitted = prev.teams.filter((t) => t.hasSubmitted).length;
                const nextSubmitted = data.teams.filter((t) => t.hasSubmitted).length;
                if (
                  prev.teams.length !== data.teams.length ||
                  prev.status !== data.status ||
                  prev.currentRound !== data.currentRound ||
                  prev.negotiationSecondsRemaining !== data.negotiationSecondsRemaining ||
                  prevSubmitted !== nextSubmitted
                ) {
                  return data;
                }
                return prev;
              });
            }
          })
          .catch(() => {});
      }
    }, 1500);

    return () => {
      clearInterval(pollInterval);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [isStaticMode]);

  const myTeam: Team | undefined =
    roomState?.teams.find((t) => t.id === myTeamId) ||
    (typeof window !== 'undefined' && currentRoomIdRef.current
      ? roomState?.teams.find((t) => {
          const savedTeamNum = window.sessionStorage.getItem(
            `civics_last_team_num_${currentRoomIdRef.current}`
          );
          return savedTeamNum ? t.teamNumber === Number(savedTeamNum) : false;
        })
      : undefined);

  return {
    isConnected,
    isStaticMode,
    connectionNote,
    roomState,
    myTeamId,
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
  };
}
