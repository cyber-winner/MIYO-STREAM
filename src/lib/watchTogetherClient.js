// Watch Together WebSocket client
// Binary protocol matching the server in server.js
// Adapted from StrawVerse's watchTogetherClient.js for MIYO

import { isNative } from '../platform/index.js';

export const OPCODES = {
  JOIN_ROOM:      0x01,
  ROOM_JOINED:    0x02,
  USER_EVENT:     0x03,
  PLAY_PAUSE:     0x04,
  TIME_SYNC:      0x05,
  LOAD_MEDIA:     0x06,
  CLIENT_READY:   0x07,
  START_PLAYBACK: 0x08,
  ADD_QUEUE:      0x09,
  CHAT_MSG:       0x0A,
  PING:           0x0B,
  PONG:           0x0C,
  ERROR:          0x0D,
  REMOVE_QUEUE:   0x0E,
  CAPTION_SYNC:  0x0F,
  VOICE_SIGNAL:  0x10,
  VOICE_STATE:   0x11,
  SYNC_MEDIA:    0x12,
};

export const USER_EVENTS = {
  JOINED:        0x00,
  LEFT:          0x01,
  HOST_CHANGE:   0x02,
  COHOST_CHANGE: 0x03,
};

class WatchTogetherClient {
  constructor() {
    this.ws = null;
    this.serverUrl = '';
    this.isConnected = false;
    this.roomCode = null;
    this.isHost = false;
    this.userID = null;
    this.username = 'Guest';
    this.users = [];
    this.messages = [];
    this.listeners = new Map();
    this.pingInterval = null;
    this.pingLatency = 0;
    // Media state for the Watch Together page
    this.currentMedia = null; // { playerSrc, isHls, subtitles, title, poster, animeId, episodeNum }
  }

  /** Store the currently playing media so WatchTogether page can pick it up */
  setCurrentMedia(media) {
    this.currentMedia = media;
    if (this.isHost) {
      this.sendSyncMedia(media);
    }
  }

  sendSyncMedia(mediaObj) {
    if (!this.isConnected || !this.roomCode || !mediaObj) return;
    const enc = new TextEncoder();
    const payload = enc.encode(JSON.stringify(mediaObj));
    const buf = new ArrayBuffer(1 + 2 + payload.length);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);
    view.setUint8(0, OPCODES.SYNC_MEDIA);
    view.setUint16(1, payload.length, false);
    u8.set(payload, 3);
    this.ws.send(buf);
  }

  /** Get the stored media state */
  getCurrentMedia() {
    return this.currentMedia;
  }

  /** Derive the WS URL from the server config or localStorage override */
  async _resolveServerUrl() {
    const stored = localStorage.getItem('miyo_wt_server');
    if (stored) return this._formatUrl(stored);

    // On native (Capacitor/Tauri), there's no local Express server.
    // Connect directly to the production Watch Together server.
    const isNativePlatform = typeof window !== 'undefined' &&
      (window.Capacitor?.isNativePlatform?.() || window.__TAURI_INTERNALS__ || window.__TAURI__);

    if (isNativePlatform) {
      // Use the production server — same one the website runs on.
      // Users can override this in localStorage('miyo_wt_server').
      const prodUrl = localStorage.getItem('miyo_wt_prod_server') || 'wss://miyo-stream.cyber-winner.site/ws';
      return prodUrl;
    }

    // Web: ask the Express server for the config
    try {
      const res = await fetch('/api/wt/config');
      if (res.ok) {
        const data = await res.json();
        if (data.wsUrl) {
          this.serverUrl = data.wsUrl;
          return data.wsUrl;
        }
      }
    } catch (e) {
      // Config endpoint unavailable, use fallback
    }
    // Fallback: same origin WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/ws`;
  }

  _formatUrl(url) {
    let f = (url || '').trim();
    if (!f) return this._resolveServerUrl();
    if (f.startsWith('https://')) f = f.replace('https://', 'wss://');
    else if (f.startsWith('http://')) f = f.replace('http://', 'ws://');
    if (!f.startsWith('wss://') && !f.startsWith('ws://')) f = 'wss://' + f;
    if (!f.endsWith('/ws')) f = f.replace(/\/+$/, '') + '/ws';
    return f;
  }

  setServerUrl(url) {
    const formatted = this._formatUrl(url);
    this.serverUrl = formatted;
    localStorage.setItem('miyo_wt_server', formatted);
  }

  async getServerUrl() {
    if (this.serverUrl) return this.serverUrl;
    return await this._resolveServerUrl();
  }

  // ---- Event emitter ----
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(cb => cb !== callback));
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  // ---- Connection ----
  async connect(username = 'Guest') {
    this.username = username;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const url = await this.getServerUrl();
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this.isConnected = true;
          this._startPing();
          this.emit('connected');
          resolve();
        };

        this.ws.onclose = () => {
          this._cleanup();
          this.emit('disconnected');
        };

        this.ws.onerror = (err) => {
          this.emit('error', { message: 'WebSocket connection error' });
          reject(err);
        };

        this.ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            this._handleBinary(event.data);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect() {
    this._cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  _cleanup() {
    this.isConnected = false;
    this.roomCode = null;
    this.isHost = false;
    this.userID = null;
    this.users = [];
    this.messages = [];
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  _startPing() {
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        const buf = new ArrayBuffer(9);
        const view = new DataView(buf);
        view.setUint8(0, OPCODES.PING);
        view.setBigInt64(1, BigInt(Date.now()), true);
        this.ws.send(buf);
      }
    }, 10000);
  }

  // ---- Room actions ----
  createRoom(username) {
    return this.joinRoom('CREATE', username);
  }

  async joinRoom(code, username) {
    if (!this.isConnected) {
      await this.connect(username || this.username);
    }
    const enc = new TextEncoder();
    const nameBytes = enc.encode(username || this.username);
    const codePadded = (code || 'CREATE').padEnd(6, ' ').slice(0, 6);
    const codeBytes = enc.encode(codePadded);

    const buf = new ArrayBuffer(1 + 6 + 1 + nameBytes.length);
    const view = new DataView(buf);
    view.setUint8(0, OPCODES.JOIN_ROOM);

    const u8 = new Uint8Array(buf);
    u8.set(codeBytes, 1);
    u8.set([nameBytes.length], 7);
    u8.set(nameBytes, 8);

    this.ws.send(buf);
  }

  // ---- Playback sync ----
  sendPlayPause(isPlaying, timestamp) {
    if (!this.isConnected || !this.roomCode) return;
    const buf = new ArrayBuffer(6);
    const view = new DataView(buf);
    view.setUint8(0, OPCODES.PLAY_PAUSE);
    view.setUint8(1, isPlaying ? 1 : 0);
    view.setFloat32(2, timestamp, false);
    this.ws.send(buf);
  }

  sendTimeSync(timestamp, speed = 1.0) {
    if (!this.isConnected || !this.roomCode) return;
    const buf = new ArrayBuffer(9);
    const view = new DataView(buf);
    view.setUint8(0, OPCODES.TIME_SYNC);
    view.setFloat32(1, timestamp, false);
    view.setFloat32(5, speed, false);
    this.ws.send(buf);
  }

  sendLoadMedia(providerID, animeID, episodeNum) {
    if (!this.isConnected || !this.roomCode) return;
    const buf = new ArrayBuffer(9);
    const view = new DataView(buf);
    view.setUint8(0, OPCODES.LOAD_MEDIA);
    view.setUint16(1, providerID || 0, false);
    view.setUint32(3, animeID || 0, false);
    view.setUint16(7, episodeNum || 1, false);
    this.ws.send(buf);
  }

  sendClientReady() {
    if (!this.isConnected || !this.roomCode) return;
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    view.setUint8(0, OPCODES.CLIENT_READY);
    view.setUint8(1, this.userID || 0);
    this.ws.send(buf);
  }

  // ---- Caption sync ----
  sendCaptionSync(trackLabel) {
    if (!this.isConnected || !this.roomCode) return;
    const enc = new TextEncoder();
    const labelBytes = enc.encode(trackLabel || '');
    const buf = new ArrayBuffer(1 + 1 + labelBytes.length);
    const u8 = new Uint8Array(buf);
    u8[0] = OPCODES.CAPTION_SYNC;
    u8[1] = labelBytes.length;
    u8.set(labelBytes, 2);
    this.ws.send(buf);
  }

  // ---- Voice chat signaling ----
  sendVoiceSignal(targetUserID, type, jsonData) {
    // type: 0=offer, 1=answer, 2=ice
    if (!this.isConnected || !this.roomCode) return;
    const enc = new TextEncoder();
    const payload = enc.encode(JSON.stringify(jsonData));
    const buf = new ArrayBuffer(1 + 1 + 1 + 2 + payload.length);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);
    view.setUint8(0, OPCODES.VOICE_SIGNAL);
    view.setUint8(1, targetUserID);
    view.setUint8(2, type);
    view.setUint16(3, payload.length, false);
    u8.set(payload, 5);
    this.ws.send(buf);
  }

  sendVoiceState(muted, deafened, active = true) {
    if (!this.isConnected || !this.roomCode) return;
    const state = (muted ? 0x01 : 0x00) | (deafened ? 0x02 : 0x00) | (active ? 0x04 : 0x00);
    const buf = new ArrayBuffer(3);
    const view = new DataView(buf);
    view.setUint8(0, OPCODES.VOICE_STATE);
    view.setUint8(1, this.userID || 0);
    view.setUint8(2, state);
    this.ws.send(buf);
  }

  // ---- Chat ----
  sendChatMessage(text) {
    if (!this.isConnected || !this.roomCode || !text.trim()) return;
    const enc = new TextEncoder();
    const senderBytes = enc.encode(this.username);
    const msgBytes = enc.encode(text.trim());

    const buf = new ArrayBuffer(1 + 1 + senderBytes.length + 2 + msgBytes.length);
    const view = new DataView(buf);
    view.setUint8(0, OPCODES.CHAT_MSG);
    view.setUint8(1, senderBytes.length);

    const u8 = new Uint8Array(buf);
    u8.set(senderBytes, 2);
    view.setUint16(2 + senderBytes.length, msgBytes.length, false);
    u8.set(msgBytes, 4 + senderBytes.length);

    this.ws.send(buf);
  }

  // ---- Binary message handler ----
  _handleBinary(buffer) {
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);
    const dec = new TextDecoder();
    const opcode = view.getUint8(0);

    switch (opcode) {
      case OPCODES.ROOM_JOINED: {
        this.isHost = view.getUint8(1) === 1;
        this.userID = view.getUint8(2);
        this.roomCode = dec.decode(u8.subarray(3, 9)).trim();
        this.users = [{ id: this.userID, username: this.username, isHost: this.isHost }];
        this.emit('roomJoined', {
          roomCode: this.roomCode,
          isHost: this.isHost,
          userID: this.userID,
        });
        break;
      }

      case OPCODES.USER_EVENT: {
        const eventType = view.getUint8(1);
        const uID = view.getUint8(2);
        const nameLen = view.getUint8(3);
        const username = dec.decode(u8.subarray(4, 4 + nameLen));

        if (eventType === USER_EVENTS.JOINED) {
          if (!this.users.some(u => u.id === uID)) {
            this.users.push({ id: uID, username, isHost: false });
          }
        } else if (eventType === USER_EVENTS.LEFT) {
          this.users = this.users.filter(u => u.id !== uID);
        } else if (eventType === USER_EVENTS.HOST_CHANGE) {
          this.users = this.users.map(u => ({
            ...u,
            isHost: u.id === uID,
          }));
          if (uID === this.userID) {
            this.isHost = true;
          } else if (this.isHost) {
            this.isHost = false;
          }
          this.emit('roomJoined', {
            roomCode: this.roomCode,
            isHost: this.isHost,
            userID: this.userID,
          });
        }
        this.emit('usersChanged', this.users);
        break;
      }

      case OPCODES.PLAY_PAUSE: {
        const isPlaying = view.getUint8(1) === 1;
        const timestamp = view.getFloat32(2, false);
        this.emit('playPause', { isPlaying, timestamp });
        break;
      }

      case OPCODES.TIME_SYNC: {
        const timestamp = view.getFloat32(1, false);
        const speed = view.getFloat32(5, false);
        this.emit('timeSync', { timestamp, speed });
        break;
      }

      case OPCODES.LOAD_MEDIA: {
        const providerID = view.getUint16(1, false);
        const animeID = view.getUint32(3, false);
        const episode = view.getUint16(7, false);
        this.emit('loadMedia', { providerID, animeID, episode });
        break;
      }

      case OPCODES.CLIENT_READY: {
        const uID = view.getUint8(1);
        this.emit('clientReady', { userID: uID });
        break;
      }

      case OPCODES.START_PLAYBACK: {
        this.emit('startPlayback');
        break;
      }

      case OPCODES.ADD_QUEUE:
      case OPCODES.REMOVE_QUEUE:
        // Queue feature removed — ignore these opcodes
        break;

      case OPCODES.CAPTION_SYNC: {
        const labelLen = view.getUint8(1);
        const trackLabel = dec.decode(u8.subarray(2, 2 + labelLen));
        this.emit('captionSync', { trackLabel });
        break;
      }

      case OPCODES.VOICE_SIGNAL: {
        // byte 1 = sender ID (rewritten by server), byte 2 = type, bytes 3-4 = json length
        const senderID = view.getUint8(1);
        const signalType = view.getUint8(2); // 0=offer, 1=answer, 2=ice
        const jsonLen = view.getUint16(3, false);
        const jsonStr = dec.decode(u8.subarray(5, 5 + jsonLen));
        try {
          const data = JSON.parse(jsonStr);
          this.emit('voiceSignal', { senderID, type: signalType, data });
        } catch (e) { /* ignore malformed */ }
        break;
      }

      case OPCODES.VOICE_STATE: {
        const uid = view.getUint8(1);
        const state = view.getUint8(2);
        this.emit('voiceState', { userID: uid, muted: !!(state & 0x01), deafened: !!(state & 0x02), active: !!(state & 0x04) });
        break;
      }

      case OPCODES.SYNC_MEDIA: {
        const len = view.getUint16(1, false);
        const jsonStr = dec.decode(u8.subarray(3, 3 + len));
        try {
          const media = JSON.parse(jsonStr);
          this.currentMedia = media;
          this.emit('mediaStateSync', media);
        } catch (e) { /* ignore malformed */ }
        break;
      }

      case OPCODES.CHAT_MSG: {
        const sLen = view.getUint8(1);
        const sender = dec.decode(u8.subarray(2, 2 + sLen));
        const mLen = view.getUint16(2 + sLen, false);
        const message = dec.decode(u8.subarray(4 + sLen, 4 + sLen + mLen));
        const msgObj = { sender, message, timestamp: new Date() };
        this.messages.push(msgObj);
        this.emit('chatMessage', msgObj);
        break;
      }

      case OPCODES.PONG: {
        const clientTime = Number(view.getBigInt64(1, true));
        this.pingLatency = Date.now() - clientTime;
        this.emit('ping', this.pingLatency);
        break;
      }

      case OPCODES.ERROR: {
        const code = view.getUint8(1);
        const mLen = view.getUint16(2, false);
        const message = dec.decode(u8.subarray(4, 4 + mLen));
        this.emit('error', { code, message });
        break;
      }
    }
  }
}

export const watchTogetherClient = new WatchTogetherClient();
export default watchTogetherClient;
