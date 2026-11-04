import type { RoomState, WSClientMessage, WSServerMessage } from '../types/game.ts';
import { LocalRoomEngine } from './localSync.ts';

// PeerJS dynamic import for browser environment
type PeerType = any;
type DataConnection = any;

const PEER_PREFIX = 'civics-anshir-v2-';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export class PeerSyncEngine {
  private static hostPeer: PeerType | null = null;
  private static clientPeer: PeerType | null = null;
  private static clientConn: DataConnection | null = null;
  private static hostConnections: Map<string, DataConnection> = new Map();

  private static currentRoomId: string | null = null;
  private static isHostActive = false;
  private static clientReconnectTimer: any = null;
  private static onServerMsgCallback: ((msg: WSServerMessage) => void) | null = null;
  private static onStatusChangeCallback: ((status: { connected: boolean; mode: string; details?: string }) => void) | null = null;

  public static onStatusChange(cb: (status: { connected: boolean; mode: string; details?: string }) => void) {
    this.onStatusChangeCallback = cb;
  }

  private static notifyStatus(connected: boolean, mode: string, details?: string) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback({ connected, mode, details });
    }
  }

  /**
   * Start host peer on Teacher's screen
   */
  public static async startHost(
    roomId: string,
    onStateBroadcast: (state: RoomState) => void
  ): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const cleanRoom = roomId.trim().toUpperCase();
    this.currentRoomId = cleanRoom;
    this.isHostActive = true;

    try {
      const { Peer } = await import('peerjs');
      const hostPeerId = `${PEER_PREFIX}${cleanRoom.toLowerCase()}`;

      if (this.hostPeer && !this.hostPeer.destroyed) {
        this.hostPeer.destroy();
      }

      this.hostConnections.clear();

      const peer = new Peer(hostPeerId, {
        config: { iceServers: ICE_SERVERS },
        debug: 1,
      });

      this.hostPeer = peer;

      peer.on('open', (id: string) => {
        console.log('[PeerSync] Host Peer ready on WebRTC cloud signaling:', id);
        this.notifyStatus(true, 'P2P_HOST', '大螢幕主機已建立雲端直連通道');
      });

      peer.on('connection', (conn: DataConnection) => {
        const peerKey = conn.peer || `peer_${Date.now()}_${Math.random()}`;
        console.log('[PeerSync] Student peer connecting:', peerKey);

        conn.on('open', () => {
          this.hostConnections.set(peerKey, conn);
          console.log('[PeerSync] Student connected via WebRTC DataChannel:', peerKey);

          // Send current room state immediately upon opening
          const currentRoom = LocalRoomEngine.getOrCreateRoom(cleanRoom);
          conn.send({
            type: 'ROOM_STATE',
            state: currentRoom,
          } as WSServerMessage);
        });

        conn.on('data', (rawData: any) => {
          try {
            const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            this.handleClientMessageAsHost(cleanRoom, msg, conn, onStateBroadcast);
          } catch (e) {
            console.warn('[PeerSync] Host failed to handle message:', e);
          }
        });

        conn.on('close', () => {
          this.hostConnections.delete(peerKey);
          console.log('[PeerSync] Student peer disconnected:', peerKey);
        });

        conn.on('error', (err: any) => {
          console.warn('[PeerSync] Student connection error:', err);
          this.hostConnections.delete(peerKey);
        });
      });

      peer.on('error', (err: any) => {
        console.warn('[PeerSync] Host peer error:', err);
        if (err.type === 'unavailable-id') {
          // If ID temporarily busy (e.g. host page refreshed within 3 seconds)
          setTimeout(() => {
            if (this.isHostActive && this.currentRoomId === cleanRoom) {
              this.startHost(cleanRoom, onStateBroadcast);
            }
          }, 2000);
        }
      });

      return true;
    } catch (e) {
      console.error('[PeerSync] Failed to start host peer:', e);
      return false;
    }
  }

  /**
   * Host processes incoming client message and updates authoritative room state
   */
  private static handleClientMessageAsHost(
    roomId: string,
    msg: WSClientMessage,
    conn: DataConnection,
    onStateBroadcast: (state: RoomState) => void
  ) {
    let updatedRoom: RoomState | null = null;
    let yourTeamId: string | undefined;

    switch (msg.type) {
      case 'JOIN_TEAM': {
        const res = LocalRoomEngine.joinTeam(roomId, msg.teamInfo);
        updatedRoom = res.room;
        yourTeamId = res.team.id;
        break;
      }

      case 'SUBMIT_BID': {
        updatedRoom = LocalRoomEngine.submitBid(roomId, msg.teamId, msg.bid, msg.agreedPrice);
        break;
      }

      case 'SUBMIT_REFLECTION': {
        updatedRoom = LocalRoomEngine.submitReflection(roomId, msg.teamId, msg.reflection);
        break;
      }

      case 'PING': {
        conn.send({ type: 'PONG' } as WSServerMessage);
        return;
      }
    }

    if (updatedRoom) {
      onStateBroadcast(updatedRoom);

      // Reply back to the sender
      conn.send({
        type: 'ROOM_STATE',
        state: updatedRoom,
        yourTeamId,
      } as WSServerMessage);

      // Broadcast updated room state to all other students
      this.broadcastToAllStudents({
        type: 'ROOM_STATE',
        state: updatedRoom,
      });
    }
  }

  /**
   * Broadcast message from Host to all connected student devices
   */
  public static broadcastToAllStudents(msg: WSServerMessage) {
    if (!this.isHostActive) return;

    for (const [key, conn] of this.hostConnections.entries()) {
      try {
        if (conn && conn.open) {
          conn.send(msg);
        }
      } catch (e) {
        console.warn(`[PeerSync] Failed to send to student ${key}:`, e);
      }
    }
  }

  /**
   * Student client connects to Teacher's host peer
   */
  public static async startClient(
    roomId: string,
    onServerMsg: (msg: WSServerMessage) => void,
    pendingJoin?: WSClientMessage
  ): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const cleanRoom = roomId.trim().toUpperCase();
    this.currentRoomId = cleanRoom;
    this.onServerMsgCallback = onServerMsg;

    if (this.clientReconnectTimer) {
      clearTimeout(this.clientReconnectTimer);
      this.clientReconnectTimer = null;
    }

    try {
      const { Peer } = await import('peerjs');
      const hostPeerId = `${PEER_PREFIX}${cleanRoom.toLowerCase()}`;
      const clientPeerId = `${PEER_PREFIX}stu-${Math.random().toString(36).substring(2, 9)}`;

      if (this.clientPeer && !this.clientPeer.destroyed) {
        this.clientPeer.destroy();
      }

      const peer = new Peer(clientPeerId, {
        config: { iceServers: ICE_SERVERS },
        debug: 1,
      });

      this.clientPeer = peer;

      peer.on('open', () => {
        console.log('[PeerSync] Student peer initialized, connecting to teacher host:', hostPeerId);
        this.connectToHostPeer(peer, hostPeerId, cleanRoom, pendingJoin);
      });

      peer.on('error', (err: any) => {
        console.warn('[PeerSync] Student peer error:', err);
        this.scheduleClientReconnect(cleanRoom, pendingJoin);
      });

      return true;
    } catch (e) {
      console.error('[PeerSync] Failed to start client peer:', e);
      return false;
    }
  }

  private static connectToHostPeer(
    peer: PeerType,
    hostPeerId: string,
    cleanRoom: string,
    pendingJoin?: WSClientMessage
  ) {
    try {
      const conn = peer.connect(hostPeerId, { reliable: true });
      this.clientConn = conn;

      conn.on('open', () => {
        console.log('[PeerSync] Successfully connected to Teacher Host Peer!');
        this.notifyStatus(true, 'P2P_CLIENT', '已成功連線至老師投影螢幕');

        if (pendingJoin) {
          console.log('[PeerSync] Sending pending join request:', pendingJoin);
          conn.send(pendingJoin);
        }
      });

      conn.on('data', (rawData: any) => {
        try {
          const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          if (this.onServerMsgCallback) {
            this.onServerMsgCallback(msg);
          }
        } catch (e) {
          console.warn('[PeerSync] Client failed to parse incoming data:', e);
        }
      });

      conn.on('close', () => {
        console.log('[PeerSync] Disconnected from Host peer, attempting reconnect...');
        this.notifyStatus(false, 'P2P_CLIENT', '與老師主機連線中斷，正在自動重連...');
        this.scheduleClientReconnect(cleanRoom, pendingJoin);
      });

      conn.on('error', (err: any) => {
        console.warn('[PeerSync] Student connection to host error:', err);
        this.scheduleClientReconnect(cleanRoom, pendingJoin);
      });
    } catch (e) {
      console.warn('[PeerSync] Failed to connect to host peer:', e);
      this.scheduleClientReconnect(cleanRoom, pendingJoin);
    }
  }

  private static scheduleClientReconnect(cleanRoom: string, pendingJoin?: WSClientMessage) {
    if (this.clientReconnectTimer) return;
    this.clientReconnectTimer = setTimeout(() => {
      this.clientReconnectTimer = null;
      if (this.currentRoomId === cleanRoom && !this.isHostActive) {
        if (this.onServerMsgCallback) {
          this.startClient(cleanRoom, this.onServerMsgCallback, pendingJoin);
        }
      }
    }, 2500);
  }

  /**
   * Send a client message over WebRTC to the Host
   */
  public static sendFromClient(msg: WSClientMessage): boolean {
    if (this.clientConn && this.clientConn.open) {
      try {
        this.clientConn.send(msg);
        return true;
      } catch (e) {
        console.warn('[PeerSync] Failed to send message to host peer:', e);
      }
    }
    return false;
  }

  /**
   * Teardown all peers
   */
  public static destroy() {
    this.isHostActive = false;
    this.currentRoomId = null;

    if (this.clientReconnectTimer) {
      clearTimeout(this.clientReconnectTimer);
      this.clientReconnectTimer = null;
    }

    if (this.clientConn) {
      try {
        this.clientConn.close();
      } catch {}
      this.clientConn = null;
    }

    if (this.clientPeer && !this.clientPeer.destroyed) {
      try {
        this.clientPeer.destroy();
      } catch {}
      this.clientPeer = null;
    }

    for (const conn of this.hostConnections.values()) {
      try {
        conn.close();
      } catch {}
    }
    this.hostConnections.clear();

    if (this.hostPeer && !this.hostPeer.destroyed) {
      try {
        this.hostPeer.destroy();
      } catch {}
      this.hostPeer = null;
    }
  }
}
