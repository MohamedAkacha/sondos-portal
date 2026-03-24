// =====================================================
// Test Agent Page — LiveKit Web Voice Call
// ─────────────────────────────────────────────────────
// Browser-based voice call to the Sondos AI Agent
// Uses LiveKit JS SDK for WebRTC connection
// =====================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { getLivekitToken, saveLivekitTranscript } from '@/services/api/livekitAPI';

// ── Call States ──
const CALL_STATE = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  AGENT_SPEAKING: 'agent_speaking',
  USER_SPEAKING: 'user_speaking',
  DISCONNECTING: 'disconnecting',
  ERROR: 'error',
};

// ── Status Labels (Arabic) ──
const STATE_LABELS = {
  [CALL_STATE.IDLE]: 'جاهز',
  [CALL_STATE.CONNECTING]: 'جاري الاتصال...',
  [CALL_STATE.CONNECTED]: 'متصل',
  [CALL_STATE.AGENT_SPEAKING]: 'سندس تتكلم...',
  [CALL_STATE.USER_SPEAKING]: 'تتكلم...',
  [CALL_STATE.DISCONNECTING]: 'جاري الإنهاء...',
  [CALL_STATE.ERROR]: 'خطأ في الاتصال',
};

const STATE_COLORS = {
  [CALL_STATE.IDLE]: 'text-gray-400',
  [CALL_STATE.CONNECTING]: 'text-yellow-400',
  [CALL_STATE.CONNECTED]: 'text-emerald-400',
  [CALL_STATE.AGENT_SPEAKING]: 'text-cyan-400',
  [CALL_STATE.USER_SPEAKING]: 'text-emerald-400',
  [CALL_STATE.DISCONNECTING]: 'text-yellow-400',
  [CALL_STATE.ERROR]: 'text-red-400',
};

export default function TestAgentPage() {
  // ── State ──
  const [callState, setCallState] = useState(CALL_STATE.IDLE);
  const [transcript, setTranscript] = useState([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [agentJoined, setAgentJoined] = useState(false);

  // ── Agent Config State — all fields sent to backend → room metadata → agent ──
  const [agentConfig, setAgentConfig] = useState({
    sttProvider: 'deepgram',
    sttModel: 'nova-2',
    sttLanguage: 'ar',
    llmModel: 'gpt-4o-mini',
    llmTemperature: 0.7,
    ttsModel: 'tts-1',
    ttsVoice: 'nova',
    systemPrompt: '',
    greeting: '',
  });

  // ── Refs ──
  const roomRef = useRef(null);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioElRef = useRef(null);
  const callIdRef = useRef(null);
  const transcriptRef = useRef([]);

  // Keep transcriptRef in sync with state
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // ── Timer ──
  useEffect(() => {
    if (callState === CALL_STATE.CONNECTED ||
        callState === CALL_STATE.AGENT_SPEAKING ||
        callState === CALL_STATE.USER_SPEAKING) {
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // ── Format duration ──
  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ══════════════════════════════════════════════════════
  // Connect to LiveKit Room
  // ══════════════════════════════════════════════════════
  const connect = useCallback(async () => {
    try {
      setCallState(CALL_STATE.CONNECTING);
      setError(null);
      setTranscript([]);
      setDuration(0);
      setAgentJoined(false);

      // 1. Get token from backend (with full agent config)
      const data = await getLivekitToken({
        sttProvider: agentConfig.sttProvider,
        sttModel: agentConfig.sttModel,
        sttLanguage: agentConfig.sttLanguage,
        llmModel: agentConfig.llmModel,
        llmTemperature: agentConfig.llmTemperature,
        ttsModel: agentConfig.ttsModel,
        ttsVoice: agentConfig.ttsVoice,
        systemPrompt: agentConfig.systemPrompt,
        greeting: agentConfig.greeting,
      });
      const { token, wsUrl, callId } = data;

      // Store callId for transcript saving later
      callIdRef.current = callId || null;

      if (!token || !wsUrl) {
        throw new Error('فشل الحصول على بيانات الاتصال');
      }

      // 2. Dynamically import LiveKit SDK
      const { Room, RoomEvent, Track, ConnectionState } = await import('livekit-client');

      // 3. Create room instance
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Audio settings optimized for voice
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      roomRef.current = room;

      // ── Room Events ──

      // Participant connected (agent joins)
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log(`[LiveKit] Participant joined: ${participant.identity}`);
        setAgentJoined(true);
        addTranscript('system', 'سندس دخلت المكالمة');
      });

      // Track subscribed (agent's audio)
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          console.log(`[LiveKit] Audio track subscribed from: ${participant.identity}`);
          // Attach audio to a hidden element to play it
          const audioEl = track.attach();
          audioEl.id = 'agent-audio';
          document.body.appendChild(audioEl);
          audioElRef.current = audioEl;
        }
      });

      // Track unsubscribed
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        const elements = track.detach();
        elements.forEach(el => el.remove());
      });

      // Agent speaking status
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (room.state !== ConnectionState.Connected) return;
        
        const localIdentity = room.localParticipant?.identity;
        const isUserSpeaking = speakers.some(s => s.identity === localIdentity);
        const isAgentSpeaking = speakers.some(s => s.identity !== localIdentity);
        
        if (isAgentSpeaking) {
          setCallState(CALL_STATE.AGENT_SPEAKING);
        } else if (isUserSpeaking) {
          setCallState(CALL_STATE.USER_SPEAKING);
        } else {
          setCallState(CALL_STATE.CONNECTED);
        }
      });

      // Transcription received (from agent data channel)
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        for (const segment of segments) {
          if (segment.final && segment.text?.trim()) {
            const isAgent = participant?.identity !== room.localParticipant?.identity;
            addTranscript(
              isAgent ? 'agent' : 'user',
              segment.text.trim()
            );
          }
        }
      });

      // Data received (fallback for transcript)
      room.on(RoomEvent.DataReceived, (data, participant) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(data));
          if (msg.type === 'transcript' && msg.text?.trim()) {
            const isAgent = participant?.identity !== room.localParticipant?.identity;
            addTranscript(isAgent ? 'agent' : 'user', msg.text.trim());
          }
        } catch (e) {
          // Not JSON, ignore
        }
      });

      // Disconnected
      room.on(RoomEvent.Disconnected, () => {
        console.log('[LiveKit] Disconnected');
        setCallState(CALL_STATE.IDLE);
        cleanupAudio();
      });

      // Connection error
      room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (quality === 'poor') {
          console.warn('[LiveKit] Poor connection quality');
        }
      });

      // 4. Connect to room with audio enabled
      await room.connect(wsUrl, token);
      
      // 5. Publish microphone
      await room.localParticipant.setMicrophoneEnabled(true);

      // 6. Setup audio visualization
      setupAudioVisualization(room);

      setCallState(CALL_STATE.CONNECTED);
      addTranscript('system', 'تم الاتصال — في انتظار سندس...');

      console.log(`[LiveKit] ✅ Connected to room: ${room.name}`);

    } catch (err) {
      console.error('[LiveKit] Connection error:', err);
      setError(err.message || 'فشل الاتصال');
      setCallState(CALL_STATE.ERROR);
      cleanupAudio();
    }
  }, [agentConfig]);

  // ══════════════════════════════════════════════════════
  // Disconnect
  // ══════════════════════════════════════════════════════
  const disconnect = useCallback(async () => {
    setCallState(CALL_STATE.DISCONNECTING);

    // ── Save transcript to backend before disconnecting ──
    if (callIdRef.current && transcriptRef.current.length > 0) {
      try {
        const entries = transcriptRef.current
          .filter(t => t.speaker !== 'system')
          .map(t => ({
            speaker: t.speaker,
            text: t.text,
            timestamp: t.time,
          }));
        if (entries.length > 0) {
          await saveLivekitTranscript(callIdRef.current, entries);
          console.log(`[LiveKit] ✅ Transcript saved: ${entries.length} entries`);
        }
      } catch (err) {
        console.warn('[LiveKit] Failed to save transcript:', err.message);
      }
    }
    
    if (roomRef.current) {
      roomRef.current.disconnect(true);
      roomRef.current = null;
    }
    
    cleanupAudio();
    callIdRef.current = null;
    setCallState(CALL_STATE.IDLE);
    setAgentJoined(false);
  }, []);

  // ── Cleanup audio resources ──
  const cleanupAudio = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.remove();
      audioElRef.current = null;
    }
    setAudioLevel(0);
  };

  // ── Audio visualization ──
  const setupAudioVisualization = (room) => {
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Connect local mic to analyser
      const localTrack = room.localParticipant?.getTrackPublication('microphone')?.track;
      if (localTrack?.mediaStream) {
        const source = audioContext.createMediaStreamSource(localTrack.mediaStream);
        source.connect(analyser);
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        setAudioLevel(Math.min(avg / 128, 1));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.warn('[Audio Viz] Failed to setup:', e.message);
    }
  };

  // ── Add transcript entry ──
  const addTranscript = (speaker, text) => {
    setTranscript(prev => [...prev, {
      id: Date.now() + Math.random(),
      speaker,
      text,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }]);
  };

  // ── Auto-scroll transcript ──
  const transcriptEndRef = useRef(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const isActive = callState !== CALL_STATE.IDLE && callState !== CALL_STATE.ERROR;

  // ══════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════
  return (
    <div className="min-h-screen p-4 md:p-6" dir="rtl">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">
          🧪 اختبار المساعد الصوتي
        </h1>
        <p className="text-gray-400 text-sm">
          اختبر مكالمة صوتية مباشرة مع سندس عبر المتصفح — LiveKit WebRTC
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ════════════════════════════════════════════════ */}
        {/* Call Panel (Main) */}
        {/* ════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Call Card */}
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm overflow-hidden">
            
            {/* Status Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/30">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  isActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                }`} />
                <span className={`text-sm font-medium ${STATE_COLORS[callState]}`}>
                  {STATE_LABELS[callState]}
                </span>
              </div>
              {isActive && (
                <span className="text-sm text-gray-400 font-mono tabular-nums">
                  {formatDuration(duration)}
                </span>
              )}
            </div>

            {/* Call Visual Area */}
            <div className="flex flex-col items-center justify-center py-12 px-6">
              
              {/* Agent Avatar with Audio Ring */}
              <div className="relative mb-6">
                <div className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl
                  ${isActive
                    ? 'bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border-2 border-cyan-500/40'
                    : 'bg-gray-700/40 border-2 border-gray-600/30'
                  }
                  transition-all duration-500`}
                >
                  🤖
                </div>
                {/* Audio Ring Animation */}
                {callState === CALL_STATE.AGENT_SPEAKING && (
                  <>
                    <div className="absolute inset-0 rounded-full border-2 border-cyan-400/50 animate-ping" />
                    <div className="absolute -inset-2 rounded-full border border-cyan-400/20 animate-pulse" />
                  </>
                )}
                {callState === CALL_STATE.USER_SPEAKING && (
                  <div className="absolute -inset-2 rounded-full border-2 border-emerald-400/30 animate-pulse" />
                )}
              </div>

              <p className="text-lg font-semibold text-white mb-1">سندس</p>
              <p className="text-xs text-gray-500 mb-6">المساعدة الذكية — Sondos AI</p>

              {/* Audio Level Bar */}
              {isActive && (
                <div className="w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden mb-8">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-75"
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
              )}

              {/* Call Buttons */}
              <div className="flex gap-4">
                {!isActive ? (
                  <button
                    onClick={connect}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white
                      bg-gradient-to-r from-emerald-600 to-emerald-500
                      hover:from-emerald-500 hover:to-emerald-400
                      active:scale-95 transition-all duration-200 shadow-lg shadow-emerald-900/30"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    ابدأ المكالمة
                  </button>
                ) : (
                  <button
                    onClick={disconnect}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white
                      bg-gradient-to-r from-red-600 to-red-500
                      hover:from-red-500 hover:to-red-400
                      active:scale-95 transition-all duration-200 shadow-lg shadow-red-900/30"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.055.902-.417 1.173l-1.293.97a.835.835 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293c.271-.362.734-.527 1.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
                    </svg>
                    إنهاء المكالمة
                  </button>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-md text-center">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Transcript Card */}
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-700/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">📝 النص المباشر</h3>
              {transcript.length > 0 && (
                <button
                  onClick={() => setTranscript([])}
                  className="text-xs text-gray-500 hover:text-gray-400"
                >
                  مسح
                </button>
              )}
            </div>
            <div className="h-64 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {transcript.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">
                  ابدأ مكالمة لرؤية النص المباشر هنا
                </p>
              ) : (
                transcript.map((entry) => (
                  <div key={entry.id} className={`flex gap-3 ${
                    entry.speaker === 'user' ? 'flex-row-reverse' : ''
                  }`}>
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      entry.speaker === 'agent'
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : entry.speaker === 'user'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-gray-600/20 text-gray-500'
                    }`}>
                      {entry.speaker === 'agent' ? '🤖' : entry.speaker === 'user' ? '🎙️' : 'ℹ️'}
                    </div>
                    {/* Message */}
                    <div className={`max-w-[75%] ${
                      entry.speaker === 'user' ? 'text-right' : ''
                    }`}>
                      <p className={`text-sm leading-relaxed ${
                        entry.speaker === 'agent'
                          ? 'text-gray-200'
                          : entry.speaker === 'user'
                          ? 'text-gray-300'
                          : 'text-gray-500 italic text-xs'
                      }`}>
                        {entry.text}
                      </p>
                      <span className="text-[10px] text-gray-600 mt-0.5 block">
                        {entry.time}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════ */}
        {/* Config Panel (Sidebar) */}
        {/* ════════════════════════════════════════════════ */}
        <div className="space-y-4">
          
          {/* Agent Config */}
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-700/30">
              <h3 className="text-sm font-semibold text-gray-300">⚙️ إعدادات الـ Agent</h3>
            </div>
            <div className="p-4 space-y-4">
              
              {/* STT Provider */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">تحويل الكلام لنص (STT)</label>
                <select
                  value={agentConfig.sttProvider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    setAgentConfig(c => ({
                      ...c,
                      sttProvider: provider,
                      sttModel: provider === 'deepgram' ? 'nova-2' : 'whisper-1',
                    }));
                  }}
                  disabled={isActive}
                  className="w-full rounded-lg bg-gray-700/50 border border-gray-600/50 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50"
                >
                  <option value="deepgram">Deepgram Nova-2 (أسرع — Streaming)</option>
                  <option value="openai">OpenAI Whisper</option>
                </select>
              </div>

              {/* STT Language */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">لغة التعرف على الكلام</label>
                <select
                  value={agentConfig.sttLanguage}
                  onChange={(e) => setAgentConfig(c => ({ ...c, sttLanguage: e.target.value }))}
                  disabled={isActive}
                  className="w-full rounded-lg bg-gray-700/50 border border-gray-600/50 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                  <option value="multi">تلقائي (متعدد اللغات)</option>
                </select>
              </div>

              {/* LLM */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">نموذج الذكاء (LLM)</label>
                <select
                  value={agentConfig.llmModel}
                  onChange={(e) => setAgentConfig(c => ({ ...c, llmModel: e.target.value }))}
                  disabled={isActive}
                  className="w-full rounded-lg bg-gray-700/50 border border-gray-600/50 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (أسرع وأرخص)</option>
                  <option value="gpt-4o">GPT-4o (أذكى)</option>
                </select>
              </div>

              {/* LLM Temperature */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  درجة الإبداع: {agentConfig.llmTemperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={agentConfig.llmTemperature}
                  onChange={(e) => setAgentConfig(c => ({ ...c, llmTemperature: parseFloat(e.target.value) }))}
                  disabled={isActive}
                  className="w-full accent-cyan-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                  <span>دقيق</span>
                  <span>إبداعي</span>
                </div>
              </div>

              {/* TTS Voice */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">الصوت (TTS)</label>
                <select
                  value={agentConfig.ttsVoice}
                  onChange={(e) => setAgentConfig(c => ({ ...c, ttsVoice: e.target.value }))}
                  disabled={isActive}
                  className="w-full rounded-lg bg-gray-700/50 border border-gray-600/50 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50"
                >
                  <option value="nova">Nova (أنثى)</option>
                  <option value="alloy">Alloy</option>
                  <option value="echo">Echo (ذكر)</option>
                  <option value="shimmer">Shimmer</option>
                </select>
              </div>

              {/* TTS Model */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">جودة الصوت</label>
                <select
                  value={agentConfig.ttsModel}
                  onChange={(e) => setAgentConfig(c => ({ ...c, ttsModel: e.target.value }))}
                  disabled={isActive}
                  className="w-full rounded-lg bg-gray-700/50 border border-gray-600/50 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50"
                >
                  <option value="tts-1">عادي (أسرع)</option>
                  <option value="tts-1-hd">HD (جودة أعلى)</option>
                </select>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  شخصية الـ Agent <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={5}
                  value={agentConfig.systemPrompt}
                  onChange={(e) => setAgentConfig(c => ({ ...c, systemPrompt: e.target.value }))}
                  disabled={isActive}
                  placeholder="اكتب تعليمات الـ Agent هنا... مثال: أنت مساعدة ذكية تعمل في عيادة الدكتور أحمد..."
                  className="w-full rounded-lg bg-gray-700/50 border border-gray-600/50 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none leading-relaxed disabled:opacity-50 placeholder:text-gray-600"
                  dir="rtl"
                />
              </div>

              {/* Greeting Message */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  رسالة الترحيب <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={agentConfig.greeting}
                  onChange={(e) => setAgentConfig(c => ({ ...c, greeting: e.target.value }))}
                  disabled={isActive}
                  placeholder="أهلاً وسهلاً، كيف أقدر أساعدك؟"
                  className="w-full rounded-lg bg-gray-700/50 border border-gray-600/50 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50 placeholder:text-gray-600"
                  dir="rtl"
                />
              </div>

              {/* Validation warning */}
              {(!agentConfig.systemPrompt || !agentConfig.greeting) && (
                <p className="text-[11px] text-amber-400/80 text-center">
                  ⚠️ شخصية الـ Agent ورسالة الترحيب مطلوبة لبدء المكالمة
                </p>
              )}

              {/* Info note */}
              <p className="text-[11px] text-cyan-500/70 text-center">
                ✅ كل الإعدادات تنتقل ديناميكياً للـ Agent — لا يوجد أي إعداد ثابت
              </p>
            </div>
          </div>

          {/* Connection Info */}
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-700/30">
              <h3 className="text-sm font-semibold text-gray-300">📡 معلومات الاتصال</h3>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">البروتوكول</span>
                <span className="text-gray-300 font-mono">WebRTC (LiveKit)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">السيرفر</span>
                <span className="text-gray-300 font-mono text-[11px]">LiveKit Cloud</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الـ Agent</span>
                <span className={agentJoined ? 'text-emerald-400' : 'text-gray-500'}>
                  {agentJoined ? '✅ متصل' : '⏳ غير متصل'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الصوت</span>
                <span className={isActive ? 'text-emerald-400' : 'text-gray-500'}>
                  {isActive ? '🎙️ الميكروفون مفعل' : '🔇 غير مفعل'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">💡 نصائح</h3>
            <ul className="space-y-2 text-xs text-gray-500 leading-relaxed">
              <li>• تأكد إن الميكروفون مسموح في المتصفح</li>
              <li>• استخدم سماعة لتجنب الصدى</li>
              <li>• الـ Agent يحتاج ثانية أو اثنتين بعد الاتصال</li>
              <li>• تقدر تقاطع سندس وهي تتكلم</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}