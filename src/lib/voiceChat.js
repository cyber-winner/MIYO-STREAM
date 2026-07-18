// Voice Chat Manager — WebRTC peer mesh for Watch Together
// Each user establishes a direct audio connection to every other user.
// The WS server only relays signaling (offer/answer/ICE), no audio.

import watchTogetherClient from './watchTogetherClient.js';

// (Removed static ICE_SERVERS to fetch dynamically)

const SIGNAL_OFFER = 0;
const SIGNAL_ANSWER = 1;
const SIGNAL_ICE = 2;

class VoiceChatManager {
  constructor() {
    this.localStream = null;
    this.peers = new Map();       // userID -> { pc, remoteAudio, remoteStream, makingOffer, ignoreOffer }
    this.muted = false;
    this.deafened = false;
    this.mutedUsers = new Set();  // user IDs we've individually muted
    this.voiceStates = new Map(); // userID -> { muted, deafened }
    this.speakingUsers = new Set();
    this.listeners = new Map();
    this.active = false;
    this._audioCtx = null;        // Shared AudioContext — reused across start/stop cycles
    this._analyserIntervalId = null;
    this._pendingAudioElements = []; // Audio elements blocked by autoplay policy

    // Bind ALL WS signal handlers in constructor so references are stable
    this._onVoiceSignal = this._onVoiceSignal.bind(this);
    this._onUserLeft = this._onUserLeft.bind(this);
    this._onVoiceState = this._onVoiceState.bind(this);
    this._onUsersChanged = this._onUsersChanged.bind(this);
    this._onRoomJoined = this._onRoomJoined.bind(this);

    // Register them permanently so we track voice states even when our mic is off
    watchTogetherClient.on('voiceSignal', this._onVoiceSignal);
    watchTogetherClient.on('voiceState', this._onVoiceState);
    watchTogetherClient.on('usersChanged', this._onUsersChanged);
    watchTogetherClient.on('roomJoined', this._onRoomJoined);
  }

  // ── Event emitter ──
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(cb);
  }
  off(event, cb) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(f => f !== cb));
  }
  emit(event, data) {
    (this.listeners.get(event) || []).forEach(cb => cb(data));
  }

  // ── Start voice chat ──
  async start() {
    if (this.active) return;
    
    // Fetch ICE servers before starting
    if (!this._iceServers) {
      try {
        const domain = import.meta.env.VITE_METERED_DOMAIN;
        const secretKey = import.meta.env.VITE_METERED_SECRET_KEY;
        
        if (domain && secretKey) {
          const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${secretKey}`);
          if (res.ok) {
            this._iceServers = await res.json();
            console.log('[VoiceChat] Loaded Metered TURN servers successfully');
          } else {
            throw new Error(`Metered API error: ${res.status}`);
          }
        } else {
          throw new Error('Metered credentials not found in env');
        }
      } catch (err) {
        console.warn("[VoiceChat] Failed to load Metered TURN servers, falling back to free OpenRelay:", err);
        this._iceServers = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { 
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ];
      }
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
        },
        video: false,
      });
    } catch (err) {
      console.error('[VoiceChat] Mic access denied:', err);
      this.emit('error', 'Microphone access denied');
      return;
    }

    this.active = true;
    this.muted = false;
    this.deafened = false;
    this._pendingAudioElements = [];

    // Ensure AudioContext is ready (resume on user gesture — this IS a user gesture context)
    if (!this._audioCtx || this._audioCtx.state === 'closed') {
      this._audioCtx = new AudioContext();
    }
    if (this._audioCtx.state === 'suspended') {
      try { await this._audioCtx.resume(); } catch {}
    }

    // Broadcast our voice state
    watchTogetherClient.sendVoiceState(this.muted, this.deafened, true);

    // Only initiate connection to users who are ALREADY active, AND only if our ID is higher
    for (const user of watchTogetherClient.users) {
      if (user.id !== watchTogetherClient.userID) {
        const state = this.voiceStates.get(user.id);
        if (state && state.active && watchTogetherClient.userID > user.id) {
          this._createOffer(user.id);
        }
      }
    }

    // Start speaking detection
    this._startSpeakingDetection();

    this.emit('started');
    this.emit('stateChanged', { muted: this.muted, deafened: this.deafened });
  }

  // ── Stop voice chat ──
  stop() {
    if (!this.active) return;
    this.active = false;

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    // Close all peer connections and clean up audio elements
    for (const [id, peer] of this.peers) {
      try { peer.pc.close(); } catch {}
      if (peer.remoteAudio) {
        peer.remoteAudio.pause();
        peer.remoteAudio.srcObject = null;
        peer.remoteAudio.remove();
      }
    }
    this.peers.clear();
    this.voiceStates.clear();
    this.speakingUsers.clear();
    this.mutedUsers.clear();
    this._pendingAudioElements = [];

    // Stop speaking detection
    if (this._analyserIntervalId) {
      clearInterval(this._analyserIntervalId);
      this._analyserIntervalId = null;
    }

    // Close AudioContext to free resources (will recreate on next start())
    if (this._audioCtx && this._audioCtx.state !== 'closed') {
      try { this._audioCtx.close(); } catch {}
      this._audioCtx = null;
    }

    // Tell others we left voice chat
    watchTogetherClient.sendVoiceState(false, false, false);

    this.emit('stopped');
  }

  // ── Mute self ──
  toggleMute() {
    this.muted = !this.muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => { t.enabled = !this.muted; });
    }
    watchTogetherClient.sendVoiceState(this.muted, this.deafened);
    this.emit('stateChanged', { muted: this.muted, deafened: this.deafened });
    return this.muted;
  }

  // ── Deafen (mute all incoming) ──
  toggleDeafen() {
    this.deafened = !this.deafened;
    for (const [, peer] of this.peers) {
      if (peer.remoteAudio) {
        peer.remoteAudio.volume = this.deafened ? 0 : 1;
      }
    }
    // Auto-mute when deafening
    if (this.deafened && !this.muted) {
      this.muted = true;
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach(t => { t.enabled = false; });
      }
    }
    // Unmute mic when un-deafening
    if (!this.deafened && this.muted) {
      this.muted = false;
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach(t => { t.enabled = true; });
      }
    }
    watchTogetherClient.sendVoiceState(this.muted, this.deafened);
    this.emit('stateChanged', { muted: this.muted, deafened: this.deafened });
    return this.deafened;
  }

  // ── Mute a specific user ──
  toggleMuteUser(userID) {
    if (this.mutedUsers.has(userID)) {
      this.mutedUsers.delete(userID);
    } else {
      this.mutedUsers.add(userID);
    }
    const peer = this.peers.get(userID);
    if (peer?.remoteAudio) {
      peer.remoteAudio.volume = this.mutedUsers.has(userID) ? 0 : (this.deafened ? 0 : 1);
    }
    this.emit('mutedUsersChanged', [...this.mutedUsers]);
    return this.mutedUsers.has(userID);
  }

  isUserMuted(userID) {
    return this.mutedUsers.has(userID);
  }

  // ── WebRTC: Create offer to a peer ──
  async _createOffer(targetID) {
    const pc = this._createPeerConnection(targetID);
    const peerEntry = this.peers.get(targetID);
    if (peerEntry) peerEntry.makingOffer = true;

    try {
      const offer = await pc.createOffer();
      // Check if connection state changed while we were creating the offer
      if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
        return;
      }
      await pc.setLocalDescription(offer);
      watchTogetherClient.sendVoiceSignal(targetID, SIGNAL_OFFER, pc.localDescription);
    } catch (err) {
      console.error('[VoiceChat] Failed to create offer for', targetID, err);
    } finally {
      if (peerEntry) peerEntry.makingOffer = false;
    }
  }

  // ── WebRTC: Create peer connection ──
  _createPeerConnection(remoteUserID) {
    // Clean up existing peer connection AND its audio element
    const existing = this.peers.get(remoteUserID);
    if (existing) {
      try { existing.pc.close(); } catch {}
      if (existing.remoteAudio) {
        existing.remoteAudio.pause();
        existing.remoteAudio.srcObject = null;
        existing.remoteAudio.remove();
      }
    }

    const pc = new RTCPeerConnection({ iceServers: this._iceServers });

    // Add local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Create audio element for remote audio
    const remoteAudio = document.createElement('audio');
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.setAttribute('data-voice-peer', String(remoteUserID));
    // Don't append to visible DOM — keep it headless
    document.body.appendChild(remoteAudio);

    const peerEntry = {
      pc,
      remoteAudio,
      remoteStream: null,
      makingOffer: false,
      ignoreOffer: false,
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      peerEntry.remoteStream = stream;
      remoteAudio.srcObject = stream;

      // Apply current volume states
      if (this.deafened || this.mutedUsers.has(remoteUserID)) {
        remoteAudio.volume = 0;
      }

      // Handle autoplay policy — play() returns a promise
      const playPromise = remoteAudio.play();
      if (playPromise) {
        playPromise.catch(() => {
          console.warn('[VoiceChat] Autoplay blocked for peer', remoteUserID, '— will retry on user gesture');
          this._pendingAudioElements.push(remoteAudio);
        });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        watchTogetherClient.sendVoiceSignal(remoteUserID, SIGNAL_ICE, event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed') {
        // Attempt ICE restart instead of immediately removing
        console.warn('[VoiceChat] Connection to', remoteUserID, 'failed — attempting ICE restart');
        this._attemptIceRestart(remoteUserID, pc);
      } else if (state === 'disconnected') {
        // Give it a moment to recover before cleaning up
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            console.warn('[VoiceChat] Connection to', remoteUserID, 'permanently lost');
            this._removePeer(remoteUserID);
          }
        }, 5000);
      }
    };

    this.peers.set(remoteUserID, peerEntry);
    return pc;
  }

  // ── ICE restart ──
  async _attemptIceRestart(remoteUserID, pc) {
    if (!this.active) return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      watchTogetherClient.sendVoiceSignal(remoteUserID, SIGNAL_OFFER, pc.localDescription);
    } catch (err) {
      console.error('[VoiceChat] ICE restart failed for', remoteUserID, err);
      this._removePeer(remoteUserID);
    }
  }

  _removePeer(userID) {
    const peer = this.peers.get(userID);
    if (!peer) return;
    try { peer.pc.close(); } catch {}
    if (peer.remoteAudio) {
      peer.remoteAudio.pause();
      peer.remoteAudio.srcObject = null;
      peer.remoteAudio.remove();
    }
    this.peers.delete(userID);
    this.speakingUsers.delete(userID);
    this.emit('speakingChanged', [...this.speakingUsers]);
  }

  // ── Handle incoming signaling messages ──
  // Uses "Perfect Negotiation" pattern to handle glare (simultaneous offers)
  async _onVoiceSignal({ senderID, type, data }) {
    if (!this.active) return;

    const myID = watchTogetherClient.userID;
    // "Polite" peer = the one with the higher ID. They yield to the lower ID's offer.
    const polite = myID > senderID;

    if (type === SIGNAL_OFFER) {
      const peerEntry = this.peers.get(senderID);
      const pc = peerEntry?.pc;

      // Glare detection: we sent an offer AND received one simultaneously
      const offerCollision = peerEntry?.makingOffer || (pc?.signalingState !== 'stable' && pc?.signalingState !== undefined);

      if (offerCollision) {
        if (!polite) {
          // Impolite peer: ignore the incoming offer, our offer wins
          if (peerEntry) peerEntry.ignoreOffer = true;
          return;
        }
        // Polite peer: rollback our offer and accept theirs
      }

      // Create or reuse peer connection
      const peerPC = pc || this._createPeerConnection(senderID);
      const currentEntry = this.peers.get(senderID);

      try {
        await peerPC.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await peerPC.createAnswer();
        await peerPC.setLocalDescription(answer);
        watchTogetherClient.sendVoiceSignal(senderID, SIGNAL_ANSWER, peerPC.localDescription);
      } catch (err) {
        console.error('[VoiceChat] Failed to handle offer from', senderID, err);
      }
      if (currentEntry) currentEntry.ignoreOffer = false;
    }

    else if (type === SIGNAL_ANSWER) {
      const peer = this.peers.get(senderID);
      if (peer?.pc) {
        try {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(data));
        } catch (err) {
          console.error('[VoiceChat] Failed to set answer from', senderID, err);
        }
      }
    }

    else if (type === SIGNAL_ICE) {
      const peer = this.peers.get(senderID);
      if (peer?.pc) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(data));
        } catch (err) {
          // Ignore late/invalid candidates — not fatal
          if (!peer.ignoreOffer) {
            console.warn('[VoiceChat] ICE candidate error for', senderID, err.message);
          }
        }
      }
    }
  }

  _onVoiceState({ userID, muted, deafened, active }) {
    this.voiceStates.set(userID, { muted, deafened, active });
    this.emit('voiceStatesChanged', Object.fromEntries(this.voiceStates));

    if (!active) {
      // User left voice chat, tear down the peer connection
      this._removePeer(userID);
    } else if (this.active && watchTogetherClient.userID > userID && !this.peers.has(userID)) {
      // User joined voice chat, we are also active, and our ID is higher -> we initiate!
      this._createOffer(userID);
    }
  }

  _onUsersChanged(users) {
    if (!this.active) return;
    
    // Broadcast our state so any newly joined users know we are active.
    // This allows them to initiate peer connections to us if their ID is higher.
    watchTogetherClient.sendVoiceState(this.muted, this.deafened);

    // Clean up departed users
    const currentIDs = new Set(users.map(u => u.id));
    for (const [id] of this.peers) {
      if (!currentIDs.has(id)) {
        this._removePeer(id);
      }
    }
  }

  _onUserLeft({ userID }) {
    this._removePeer(userID);
  }

  _onRoomJoined() {
    if (this.active) {
      watchTogetherClient.sendVoiceState(this.muted, this.deafened, true);
    }
  }

  // ── Retry any autoplay-blocked audio elements ──
  // Call this on any user interaction in the UI
  retryAutoplay() {
    const pending = [...this._pendingAudioElements];
    this._pendingAudioElements = [];
    for (const audio of pending) {
      if (audio.srcObject) {
        audio.play().catch(() => {
          // Still blocked, re-add
          this._pendingAudioElements.push(audio);
        });
      }
    }
  }

  // ── Speaking detection (analyser on local stream) ──
  _startSpeakingDetection() {
    if (this._analyserIntervalId) return;
    if (!this._audioCtx || this._audioCtx.state === 'closed') return;

    try {
      const audioCtx = this._audioCtx;

      // Local mic speaking detection
      if (this.localStream) {
        const localSource = audioCtx.createMediaStreamSource(this.localStream);
        const localAnalyser = audioCtx.createAnalyser();
        localAnalyser.fftSize = 256;
        localSource.connect(localAnalyser);
        const localData = new Uint8Array(localAnalyser.frequencyBinCount);

        this._analyserIntervalId = setInterval(() => {
          if (!this.active) {
            clearInterval(this._analyserIntervalId);
            this._analyserIntervalId = null;
            return;
          }

          // Check local mic
          localAnalyser.getByteFrequencyData(localData);
          const localAvg = localData.reduce((a, b) => a + b, 0) / localData.length;
          const myID = watchTogetherClient.userID;

          const wasSpeaking = this.speakingUsers.has(myID);
          if (localAvg > 15 && !this.muted) {
            this.speakingUsers.add(myID);
          } else {
            this.speakingUsers.delete(myID);
          }
          if (wasSpeaking !== this.speakingUsers.has(myID)) {
            this.emit('speakingChanged', [...this.speakingUsers]);
          }
        }, 100);
      }
    } catch (err) {
      console.warn('[VoiceChat] Speaking detection failed:', err);
    }
  }
}

export const voiceChatManager = new VoiceChatManager();
export default voiceChatManager;
