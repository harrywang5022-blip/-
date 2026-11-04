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

export function useGameSocket() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const pendingJoinRef = useRef<WSClientMessage | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setLastError(null);

        // Setup ping keep-alive
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 15000);

        // Re-send pending join message if any
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
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Retry connection in 2.5 seconds
        setTimeout(() => {
          if (currentRoomIdRef.current) {
            connect();
          }
        }, 2500);
      };

      ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket:', e);
    }
  }, []);

  const sendMessage = useCallback((msg: WSClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('Socket not open. Queuing join message if applicable.');
      if (msg.type === 'JOIN_HOST' || msg.type === 'JOIN_TEAM') {
        pendingJoinRef.current = msg;
      }
    }
  }, []);

  const joinAsHost = useCallback(
    (roomId: string) => {
      currentRoomIdRef.current = roomId;
      const msg: WSClientMessage = { type: 'JOIN_HOST', roomId };
      pendingJoinRef.current = msg;
      connect();
      sendMessage(msg);
    },
    [connect, sendMessage]
  );

  const joinAsTeam = useCallback(
    (
      roomId: string,
      teamInfo: { teamId?: string; teamNumber: number; name: string; members: string; brandTag: string }
    ) => {
      const cleanRoom = roomId.trim().toUpperCase();
      currentRoomIdRef.current = cleanRoom;

      // Maintain persistent teamId per room in sessionStorage
      const storageKey = `civics_team_id_${cleanRoom}_n${teamInfo.teamNumber}`;
      let assignedTeamId = teamInfo.teamId;
      if (!assignedTeamId && typeof window !== 'undefined') {
        assignedTeamId = window.sessionStorage.getItem(storageKey) || undefined;
      }
      if (!assignedTeamId) {
        assignedTeamId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(storageKey, assignedTeamId);
        }
      }

      const fullTeamInfo = { ...teamInfo, teamId: assignedTeamId };
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
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.team) {
            setMyTeamId(data.team.id);
            setRoomState(data.room);
          }
        })
        .catch((e) => console.warn('HTTP join fallback failed:', e));
    },
    [connect, sendMessage]
  );

  const submitBid = useCallback(
    (bid: BidPrice, agreedPrice?: number) => {
      if (!roomState || !myTeamId) return;
      const roomId = roomState.roomId;
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
          }
        })
        .catch(() => {});
    },
    [roomState, myTeamId, sendMessage]
  );

  const submitReflection = useCallback(
    (reflection: TeamReflection) => {
      if (!roomState || !myTeamId) return;
      const roomId = roomState.roomId;
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
          }
        })
        .catch(() => {});
    },
    [roomState, myTeamId, sendMessage]
  );

  const hostStartRound = useCallback(
    (round: number) => {
      if (!roomState) return;
      const roomId = roomState.roomId;
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
          }
        })
        .catch((e) => console.warn('HTTP start-round fallback failed:', e));
    },
    [roomState, sendMessage]
  );

  const hostForceReveal = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;
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
        }
      })
      .catch(() => {});
  }, [roomState, sendMessage]);

  const hostNextPhase = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;
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
        }
      })
      .catch(() => {});
  }, [roomState, sendMessage]);

  const hostAddAI = useCallback(
    (count = 2) => {
      if (!roomState) return;
      const roomId = roomState.roomId;
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
          }
        })
        .catch(() => {});
    },
    [roomState, sendMessage]
  );

  const hostReset = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;
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
        }
      })
      .catch(() => {});
  }, [roomState, sendMessage]);

  const hostKickTeam = useCallback(
    (teamId: string) => {
      if (!roomState) return;
      const roomId = roomState.roomId;
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
          }
        })
        .catch(() => {});
    },
    [roomState, sendMessage]
  );

  const hostSetTeamBid = useCallback(
    (teamId: string, bid: BidPrice, agreedPrice?: number) => {
      if (!roomState) return;
      const roomId = roomState.roomId;
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
          }
        })
        .catch(() => {});
    },
    [roomState, sendMessage]
  );

  const hostStartTimer = useCallback(
    (seconds = 90) => {
      if (!roomState) return;
      const roomId = roomState.roomId;
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
          }
        })
        .catch(() => {});
    },
    [roomState, sendMessage]
  );

  const hostPauseTimer = useCallback(() => {
    if (!roomState) return;
    const roomId = roomState.roomId;
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
        }
      })
      .catch(() => {});
  }, [roomState, sendMessage]);

  useEffect(() => {
    // Polling fallback to guarantee state synchronization even if WebSocket drops or throttles
    const pollInterval = setInterval(() => {
      if (currentRoomIdRef.current) {
        fetch(`/api/rooms/${encodeURIComponent(currentRoomIdRef.current)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: RoomState | null) => {
            if (data && data.roomId) {
              setRoomState((prev) => {
                // If teams count or status changed, sync state
                if (!prev) return data;
                if (
                  prev.teams.length !== data.teams.length ||
                  prev.status !== data.status ||
                  prev.currentRound !== data.currentRound
                ) {
                  return data;
                }
                return prev;
              });
            }
          })
          .catch(() => {});
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const myTeam: Team | undefined = roomState?.teams.find((t) => t.id === myTeamId);

  return {
    isConnected,
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
