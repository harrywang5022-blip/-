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

export function useGameSocket() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStaticMode, setIsStaticMode] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const pendingJoinRef = useRef<WSClientMessage | null>(null);

  // Initialize Local sync engine for GitHub Pages or offline fallback
  useEffect(() => {
    LocalRoomEngine.init();
    const unsub = LocalRoomEngine.subscribe((updatedRoom) => {
      if (currentRoomIdRef.current && updatedRoom.roomId === currentRoomIdRef.current) {
        setRoomState({ ...updatedRoom });
        setIsConnected(true);
      }
    });
    return () => unsub();
  }, []);

  const connect = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Check if WebSocket is supported and protocol is appropriate
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setLastError(null);

        // Ping keep-alive
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 15000);

        // Re-send pending message if any
        if (pendingJoinRef.current) {
          ws.send(JSON.stringify(pendingJoinRef.current));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSServerMessage;
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
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        // When WebSocket drops, do NOT mark disconnected if HTTP polling or LocalEngine is working!
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        setTimeout(() => {
          if (currentRoomIdRef.current && !isStaticMode) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection not available (will use HTTP / Local sync):', err);
      };
    } catch (e) {
      console.warn('Failed to initialize WebSocket:', e);
    }
  }, [isStaticMode]);

  // Initial connection probe on mount
  useEffect(() => {
    // 1. Try checking /api/health
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeoutId);
        if (res.ok) {
          setIsConnected(true);
          setIsStaticMode(false);
          connect();
        } else {
          // Static host (like GitHub Pages where /api returns 404 or html)
          setIsStaticMode(true);
          setIsConnected(true);
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Could be static GitHub Pages or offline
        setIsStaticMode(true);
        setIsConnected(true);
      });

    return () => {
      clearTimeout(timeoutId);
    };
  }, [connect]);

  const sendMessage = useCallback((msg: WSClientMessage) => {
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

      if (isStaticMode) {
        const room = LocalRoomEngine.getOrCreateRoom(cleanRoom);
        setRoomState(room);
        setIsConnected(true);
        return;
      }

      const msg: WSClientMessage = { type: 'JOIN_HOST', roomId: cleanRoom };
      pendingJoinRef.current = msg;
      connect();
      sendMessage(msg);

      // Direct HTTP fetch to immediately load room state without waiting
      fetch(`/api/rooms/${encodeURIComponent(cleanRoom)}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('API not available');
        })
        .then((data: RoomState) => {
          if (data && data.roomId) {
            setRoomState(data);
            setIsConnected(true);
          }
        })
        .catch(() => {
          // If server fails, fallback to local room engine
          setIsStaticMode(true);
          const room = LocalRoomEngine.getOrCreateRoom(cleanRoom);
          setRoomState(room);
          setIsConnected(true);
        });
    },
    [connect, sendMessage, isStaticMode]
  );

  const joinAsTeam = useCallback(
    (
      roomId: string,
      teamInfo: { teamId?: string; teamNumber: number; name: string; members: string; brandTag: string }
    ) => {
      const cleanRoom = roomId.trim().toUpperCase();
      currentRoomIdRef.current = cleanRoom;

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

      if (isStaticMode) {
        const res = LocalRoomEngine.joinTeam(cleanRoom, fullTeamInfo);
        setMyTeamId(res.team.id);
        setRoomState(res.room);
        setIsConnected(true);
        return;
      }

      const msg: WSClientMessage = { type: 'JOIN_TEAM', roomId: cleanRoom, teamInfo: fullTeamInfo };
      pendingJoinRef.current = msg;
      connect();
      sendMessage(msg);

      // HTTP fallback for guaranteed instant registration
      fetch(`/api/rooms/${encodeURIComponent(cleanRoom)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamInfo: fullTeamInfo }),
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('API join failed');
        })
        .then((data) => {
          if (data && data.team) {
            setMyTeamId(data.team.id);
            setRoomState(data.room);
            setIsConnected(true);
          }
        })
        .catch(() => {
          // Static host fallback
          setIsStaticMode(true);
          const res = LocalRoomEngine.joinTeam(cleanRoom, fullTeamInfo);
          setMyTeamId(res.team.id);
          setRoomState(res.room);
          setIsConnected(true);
        });
    },
    [connect, sendMessage, isStaticMode]
  );

  const submitBid = useCallback(
    (bid: BidPrice, agreedPrice?: number) => {
      if (!roomState || !myTeamId) return;
      const roomId = roomState.roomId;

      if (isStaticMode) {
        const updated = LocalRoomEngine.submitBid(roomId, myTeamId, bid, agreedPrice);
        setRoomState(updated);
        sound.playPop();
        return;
      }

      sendMessage({
        type: 'SUBMIT_BID',
        roomId,
        teamId: myTeamId,
        bid,
        agreedPrice,
      });
      sound.playPop();

      // HTTP fallback for guaranteed bid submission
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: myTeamId, bid, agreedPrice }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.room) {
            setRoomState(data.room);
            setIsConnected(true);
          }
        })
        .catch(() => {});
    },
    [roomState, myTeamId, sendMessage, isStaticMode]
  );

  const submitReflection = useCallback(
    (reflection: TeamReflection) => {
      if (!roomState || !myTeamId) return;
      const roomId = roomState.roomId;

      if (isStaticMode) {
        const updated = LocalRoomEngine.submitReflection(roomId, myTeamId, reflection);
        setRoomState(updated);
        return;
      }

      sendMessage({
        type: 'SUBMIT_REFLECTION',
        roomId,
        teamId: myTeamId,
        reflection,
      });

      // HTTP fallback
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/reflection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: myTeamId, reflection }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.room) {
            setRoomState(data.room);
            setIsConnected(true);
          }
        })
        .catch(() => {});
    },
    [roomState, myTeamId, sendMessage, isStaticMode]
  );

  const hostStartRound = useCallback(
    (round: number) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      if (isStaticMode) {
        const updated = LocalRoomEngine.startRound(roomId, round);
        setRoomState(updated);
        return;
      }

      sendMessage({ type: 'HOST_START_ROUND', roomId, round });

      // HTTP fallback
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/start-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.room) {
            setRoomState(data.room);
            setIsConnected(true);
          }
        })
        .catch((e) => console.warn('HTTP start-round fallback failed:', e));
    },
    [roomState, sendMessage, isStaticMode]
  );

  const hostForceReveal = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;

    if (isStaticMode) {
      sound.playDrumRoll();
      const updated = LocalRoomEngine.settleRound(roomId);
      setRoomState(updated);
      return;
    }

    sendMessage({ type: 'HOST_FORCE_REVEAL', roomId });
    sound.playDrumRoll();

    // HTTP fallback
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/force-reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.room) {
          setRoomState(data.room);
          setIsConnected(true);
        }
      })
      .catch(() => {});
  }, [roomState, sendMessage, isStaticMode]);

  const hostNextPhase = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;

    if (isStaticMode) {
      const updated = LocalRoomEngine.nextPhase(roomId);
      setRoomState(updated);
      return;
    }

    sendMessage({ type: 'HOST_NEXT_PHASE', roomId });

    // HTTP fallback
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/next-phase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.room) {
          setRoomState(data.room);
          setIsConnected(true);
        }
      })
      .catch(() => {});
  }, [roomState, sendMessage, isStaticMode]);

  const hostAddAI = useCallback(
    (count = 2) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      if (isStaticMode) {
        const updated = LocalRoomEngine.addAI(roomId, count);
        setRoomState(updated);
        return;
      }

      sendMessage({ type: 'HOST_ADD_AI_TEAMS', roomId, count });

      // HTTP fallback
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/add-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.room) {
            setRoomState(data.room);
            setIsConnected(true);
          }
        })
        .catch(() => {});
    },
    [roomState, sendMessage, isStaticMode]
  );

  const hostReset = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;

    if (isStaticMode) {
      const updated = LocalRoomEngine.reset(roomId);
      setRoomState(updated);
      return;
    }

    sendMessage({ type: 'HOST_RESET_GAME', roomId });

    // HTTP fallback
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.room) {
          setRoomState(data.room);
          setIsConnected(true);
        }
      })
      .catch(() => {});
  }, [roomState, sendMessage, isStaticMode]);

  const hostKickTeam = useCallback(
    (teamId: string) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      if (isStaticMode) {
        const updated = LocalRoomEngine.kickTeam(roomId, teamId);
        setRoomState(updated);
        return;
      }

      sendMessage({ type: 'HOST_KICK_TEAM', roomId, teamId });

      // HTTP fallback
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/kick-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.room) {
            setRoomState(data.room);
            setIsConnected(true);
          }
        })
        .catch(() => {});
    },
    [roomState, sendMessage, isStaticMode]
  );

  const hostSetTeamBid = useCallback(
    (teamId: string, bid: BidPrice, agreedPrice?: number) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      if (isStaticMode) {
        const updated = LocalRoomEngine.submitBid(roomId, teamId, bid, agreedPrice);
        setRoomState(updated);
        sound.playPop();
        return;
      }

      sendMessage({ type: 'HOST_SET_TEAM_BID', roomId, teamId, bid, agreedPrice });
      sound.playPop();

      // HTTP fallback
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/set-team-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, bid, agreedPrice }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.room) {
            setRoomState(data.room);
            setIsConnected(true);
          }
        })
        .catch(() => {});
    },
    [roomState, sendMessage, isStaticMode]
  );

  const hostStartTimer = useCallback(
    (seconds = 90) => {
      if (!roomState) return;
      const roomId = roomState.roomId;

      if (isStaticMode) {
        const room = LocalRoomEngine.getOrCreateRoom(roomId);
        room.negotiationSecondsRemaining = seconds;
        room.isTimerRunning = true;
        LocalRoomEngine.saveRoom(room);
        setRoomState({ ...room });
        return;
      }

      sendMessage({ type: 'HOST_START_TIMER', roomId, seconds });

      // HTTP fallback
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', seconds }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.room) {
            setRoomState(data.room);
            setIsConnected(true);
          }
        })
        .catch(() => {});
    },
    [roomState, sendMessage, isStaticMode]
  );

  const hostPauseTimer = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;

    if (isStaticMode) {
      const room = LocalRoomEngine.getOrCreateRoom(roomId);
      room.isTimerRunning = false;
      LocalRoomEngine.saveRoom(room);
      setRoomState({ ...room });
      return;
    }

    sendMessage({ type: 'HOST_PAUSE_TIMER', roomId });

    // HTTP fallback
    fetch(`/api/rooms/${encodeURIComponent(roomId)}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause' }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.room) {
          setRoomState(data.room);
          setIsConnected(true);
        }
      })
      .catch(() => {});
  }, [roomState, sendMessage, isStaticMode]);

  // Polling fallback to guarantee state synchronization even if WebSocket drops or throttles
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
                // Update if teams, status, round, timer or submission changed
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
