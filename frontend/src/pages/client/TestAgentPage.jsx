// =====================================================
// Test Agent Page — Professional Voice Call UI
// ─────────────────────────────────────────────────────
// Immersive full-screen call experience
// Settings in overlay drawer — not cluttering the call screen
// ALL LiveKit logic preserved 100%
// =====================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Phone, PhoneOff, Mic, MicOff, Settings2, X,
  ChevronRight, Bot, Trash2, AlertCircle, Sparkles,
  MessageSquareText, WifiOff, Loader2, Check, Save,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getLivekitToken, saveLivekitTranscript } from '@/services/api/livekitAPI';
import { getAgent, updateAgent } from '@/services/api/agentAPI';

const CALL_STATE = {
  IDLE: 'idle', CONNECTING: 'connecting', CONNECTED: 'connected',
  AGENT_SPEAKING: 'agent_speaking', USER_SPEAKING: 'user_speaking',
  DISCONNECTING: 'disconnecting', ERROR: 'error',
};
const STATE_LABELS = {
  [CALL_STATE.IDLE]: 'جاهز للاتصال', [CALL_STATE.CONNECTING]: 'جاري الاتصال...',
  [CALL_STATE.CONNECTED]: 'متصل', [CALL_STATE.AGENT_SPEAKING]: 'سندس تتكلم...',
  [CALL_STATE.USER_SPEAKING]: 'تتكلم...', [CALL_STATE.DISCONNECTING]: 'جاري الإنهاء...',
  [CALL_STATE.ERROR]: 'فشل الاتصال',
};

export default function TestAgentPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [callState, setCallState] = useState(CALL_STATE.IDLE);
  const [transcript, setTranscript] = useState([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [agentJoined, setAgentJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [configDirty, setConfigDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const [agentConfig, setAgentConfig] = useState({
    sttProvider: 'deepgram', sttModel: 'nova-2', sttLanguage: 'ar',
    llmModel: 'gpt-5.4-mini', llmTemperature: 0.7,
    ttsProvider: 'openai', ttsModel: 'tts-1', ttsVoice: 'nova',
    systemPrompt: '', greeting: '',
  });

  const roomRef = useRef(null);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioElRef = useRef(null);
  const callIdRef = useRef(null);
  const transcriptRef = useRef([]);
  const transcriptEndRef = useRef(null);

  const [searchParams] = useSearchParams();
  const agentIdParam = searchParams.get('agentId');
  const [agentMode, setAgentMode] = useState(false);
  const [agentName, setAgentName] = useState('');

  useEffect(() => {
    if (!agentIdParam) return;
    (async () => {
      try {
        const res = await getAgent(agentIdParam);
        if (res.success && res.agent) {
          const a = res.agent;
          setAgentConfig({
            sttProvider: a.stt?.provider || 'deepgram', sttModel: a.stt?.model || 'nova-2',
            sttLanguage: a.stt?.language || 'ar', llmModel: a.llm?.model || 'gpt-5.4-mini',
            llmTemperature: a.llm?.temperature || 0.7, ttsProvider: a.voice?.provider || 'openai',
            ttsModel: a.voice?.model || 'tts-1', ttsVoice: a.voice?.voiceId || 'nova',
            systemPrompt: a.systemPrompt || '', greeting: a.greeting || 'أهلاً وسهلاً',
          });
          setAgentMode(true); setAgentName(a.name);
          setConfigDirty(false);
        }
      } catch (err) { console.error('Failed to load agent:', err); }
    })();
  }, [agentIdParam]);

  // ── Track config changes ──
  const updateConfig = (updater) => {
    setAgentConfig(updater);
    setConfigDirty(true);
    setSavedMsg('');
  };

  // ── Save modified config back to Agent in DB ──
  const handleSaveToAgent = async () => {
    if (!agentIdParam || !agentMode) return;
    setSaving(true); setSavedMsg('');
    try {
      await updateAgent(agentIdParam, {
        stt: { provider: agentConfig.sttProvider, model: agentConfig.sttModel, language: agentConfig.sttLanguage },
        llm: { model: agentConfig.llmModel, temperature: agentConfig.llmTemperature },
        voice: { provider: agentConfig.ttsProvider, model: agentConfig.ttsModel, voiceId: agentConfig.ttsVoice },
        systemPrompt: agentConfig.systemPrompt,
        useCustomPrompt: true,
        greeting: agentConfig.greeting,
      });
      setConfigDirty(false);
      setSavedMsg('تم الحفظ ✓');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setSavedMsg('فشل الحفظ ✗');
    } finally { setSaving(false); }
  };

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => () => { disconnect(); }, []);

  useEffect(() => {
    const active = [CALL_STATE.CONNECTED, CALL_STATE.AGENT_SPEAKING, CALL_STATE.USER_SPEAKING];
    if (active.includes(callState)) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } else { if (timerRef.current) clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  const fmtDur = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const isActive = callState !== CALL_STATE.IDLE && callState !== CALL_STATE.ERROR;
  const canStart = agentConfig.systemPrompt && agentConfig.greeting;

  // ═══════════ CONNECT (100% original) ═══════════
  const connect = useCallback(async () => {
    try {
      setCallState(CALL_STATE.CONNECTING); setError(null); setTranscript([]); setDuration(0); setAgentJoined(false);
      const data = await getLivekitToken({ agentId: agentIdParam || undefined, ...agentConfig });
      const { token, wsUrl, callId } = data; callIdRef.current = callId || null;
      if (!token || !wsUrl) throw new Error('فشل الحصول على بيانات الاتصال');
      const { Room, RoomEvent, Track, ConnectionState } = await import('livekit-client');
      const room = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      roomRef.current = room;
      room.on(RoomEvent.ParticipantConnected, () => { setAgentJoined(true); addTranscript('system', 'سندس انضمت للمكالمة'); });
      room.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio) { const el = track.attach(); el.id='agent-audio'; document.body.appendChild(el); audioElRef.current=el; }});
      room.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach(el => el.remove()); });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (room.state !== ConnectionState.Connected) return;
        const lid = room.localParticipant?.identity;
        if (speakers.some(s => s.identity !== lid)) setCallState(CALL_STATE.AGENT_SPEAKING);
        else if (speakers.some(s => s.identity === lid)) setCallState(CALL_STATE.USER_SPEAKING);
        else setCallState(CALL_STATE.CONNECTED);
      });
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        for (const seg of segments) if (seg.final && seg.text?.trim()) addTranscript(participant?.identity !== room.localParticipant?.identity ? 'agent' : 'user', seg.text.trim());
      });
      room.on(RoomEvent.DataReceived, (data, participant) => {
        try { const msg = JSON.parse(new TextDecoder().decode(data)); if (msg.type==='transcript' && msg.text?.trim()) addTranscript(participant?.identity !== room.localParticipant?.identity ? 'agent' : 'user', msg.text.trim()); } catch(e){}
      });
      room.on(RoomEvent.Disconnected, () => { setCallState(CALL_STATE.IDLE); cleanupAudio(); });
      room.on(RoomEvent.ConnectionQualityChanged, (q) => { if (q==='poor') console.warn('[LiveKit] Poor connection'); });
      await room.connect(wsUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setupAudioViz(room); setCallState(CALL_STATE.CONNECTED);
      addTranscript('system', 'تم الاتصال — في انتظار سندس...');
    } catch (err) { console.error('[LiveKit]', err); setError(err.message||'فشل الاتصال'); setCallState(CALL_STATE.ERROR); cleanupAudio(); }
  }, [agentConfig]);

  const disconnect = useCallback(async () => {
    setCallState(CALL_STATE.DISCONNECTING);
    if (callIdRef.current && transcriptRef.current.length > 0) {
      try { const entries = transcriptRef.current.filter(t=>t.speaker!=='system').map(t=>({speaker:t.speaker,text:t.text,timestamp:t.time})); if(entries.length>0) await saveLivekitTranscript(callIdRef.current, entries); } catch(e){}
    }
    if (roomRef.current) { roomRef.current.disconnect(true); roomRef.current=null; }
    cleanupAudio(); callIdRef.current=null; setCallState(CALL_STATE.IDLE); setAgentJoined(false); setIsMuted(false);
  }, []);

  const toggleMute = useCallback(async () => {
    if (roomRef.current?.localParticipant) { const m=!isMuted; await roomRef.current.localParticipant.setMicrophoneEnabled(!m); setIsMuted(m); }
  }, [isMuted]);

  const cleanupAudio = () => {
    if(animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if(audioContextRef.current){audioContextRef.current.close().catch(()=>{}); audioContextRef.current=null;}
    if(audioElRef.current){audioElRef.current.remove(); audioElRef.current=null;} setAudioLevel(0);
  };
  const setupAudioViz = (room) => {
    try { const ctx=new AudioContext(); audioContextRef.current=ctx; const an=ctx.createAnalyser(); an.fftSize=256; analyserRef.current=an;
      const t=room.localParticipant?.getTrackPublication('microphone')?.track; if(t?.mediaStream) ctx.createMediaStreamSource(t.mediaStream).connect(an);
      const d=new Uint8Array(an.frequencyBinCount); const upd=()=>{an.getByteFrequencyData(d); setAudioLevel(Math.min(d.reduce((s,v)=>s+v,0)/d.length/128,1)); animFrameRef.current=requestAnimationFrame(upd);}; upd();
    } catch(e){ console.warn('[Audio]', e.message); }
  };
  const addTranscript = (speaker, text) => {
    setTranscript(prev => [...prev, { id: Date.now()+Math.random(), speaker, text, time: new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) }]);
  };

  // ═══════════ RENDER ═══════════
  const ringColor = callState === CALL_STATE.AGENT_SPEAKING ? 'cyan' : callState === CALL_STATE.USER_SPEAKING ? 'emerald' : 'gray';

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden" dir="rtl">

      {/* ═══ CALL SCREEN ═══ */}
      <div className="flex-1 relative flex flex-col items-center justify-center"
        style={isActive ? { background: `radial-gradient(ellipse at 50% 30%, ${ringColor === 'cyan' ? 'rgba(6,182,212,0.06)' : ringColor === 'emerald' ? 'rgba(16,185,129,0.05)' : 'transparent'} 0%, transparent 60%)` } : undefined}>

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 py-3 z-10">
          <button onClick={() => navigate(agentIdParam ? `/agents/${agentIdParam}` : '/agents')}
            className={`flex items-center gap-1.5 text-sm ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'} transition-colors`}>
            <ChevronRight className="w-4 h-4" />
            <span>{agentMode ? agentName : 'الرجوع'}</span>
          </button>
          <div className="flex items-center gap-2">
            {isActive && (
              <span className={`text-xs font-mono tabular-nums px-2.5 py-1 rounded-full ${isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                {fmtDur(duration)}
              </span>
            )}
            {!isActive && (
              <button onClick={() => setSettingsOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isDark ? 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} transition-colors`}>
                <Settings2 className="w-4 h-4" /> الإعدادات
              </button>
            )}
          </div>
        </div>

        {/* Avatar + rings */}
        <div className="relative mb-8">
          {isActive && <>
            <div className="absolute rounded-full transition-all duration-150 pointer-events-none"
              style={{ inset: `-${20 + audioLevel * 30}px`, border: `1.5px solid ${ringColor === 'cyan' ? 'rgba(6,182,212,0.15)' : ringColor === 'emerald' ? 'rgba(16,185,129,0.15)' : 'rgba(100,100,100,0.08)'}`, borderRadius: '50%' }} />
            <div className="absolute rounded-full transition-all duration-150 pointer-events-none"
              style={{ inset: `-${10 + audioLevel * 15}px`, border: `1.5px solid ${ringColor === 'cyan' ? 'rgba(6,182,212,0.25)' : ringColor === 'emerald' ? 'rgba(16,185,129,0.25)' : 'rgba(100,100,100,0.1)'}`, borderRadius: '50%' }} />
          </>}
          <div className={`relative z-10 w-36 h-36 rounded-full flex items-center justify-center transition-all duration-700 ${
            callState === CALL_STATE.AGENT_SPEAKING ? 'bg-gradient-to-br from-cyan-500/15 to-teal-500/15 shadow-[0_0_60px_rgba(6,182,212,0.12)]'
            : callState === CALL_STATE.USER_SPEAKING ? 'bg-gradient-to-br from-emerald-500/15 to-teal-500/15 shadow-[0_0_60px_rgba(16,185,129,0.1)]'
            : isDark ? 'bg-[#1a1a1d]' : 'bg-gray-100'
          }`}>
            <Bot className={`w-14 h-14 transition-colors duration-500 ${
              callState === CALL_STATE.AGENT_SPEAKING ? 'text-cyan-400' : callState === CALL_STATE.USER_SPEAKING ? 'text-emerald-400' : isActive ? 'text-teal-400' : isDark ? 'text-gray-600' : 'text-gray-400'
            }`} strokeWidth={1.5} />
          </div>
        </div>

        <h2 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{agentMode ? agentName : 'سندس'}</h2>
        <p className={`text-sm mb-8 ${
          callState === CALL_STATE.AGENT_SPEAKING ? 'text-cyan-400' : callState === CALL_STATE.USER_SPEAKING ? 'text-emerald-400' : isDark ? 'text-gray-500' : 'text-gray-400'
        }`}>{isActive ? STATE_LABELS[callState] : 'Sondos AI'}</p>

        {/* Audio bar */}
        {isActive && (
          <div className={`w-56 h-1 rounded-full overflow-hidden mb-8 ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-200'}`}>
            <div className="h-full rounded-full transition-all duration-75"
              style={{ width: `${audioLevel * 100}%`, background: ringColor === 'cyan' ? 'linear-gradient(90deg,#06b6d4,#14b8a6)' : 'linear-gradient(90deg,#10b981,#34d399)' }} />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-5">
          {!isActive ? (
            <button onClick={connect} disabled={!canStart}
              className="w-20 h-20 rounded-full flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white active:scale-90 transition-all duration-200 shadow-[0_8px_32px_rgba(16,185,129,0.35)] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100">
              <Phone className="w-8 h-8" />
            </button>
          ) : (<>
            <button onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
                isMuted ? 'bg-amber-500/15 text-amber-400' : isDark ? 'bg-[#1a1a1d] text-gray-400 hover:bg-[#222225]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button onClick={disconnect}
              className="w-20 h-20 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-400 text-white active:scale-90 transition-all duration-200 shadow-[0_8px_32px_rgba(239,68,68,0.3)]">
              <PhoneOff className="w-8 h-8" />
            </button>
            <button onClick={() => setTranscriptOpen(!transcriptOpen)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
                transcriptOpen ? 'bg-teal-500/15 text-teal-400' : isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
              <MessageSquareText className="w-5 h-5" />
            </button>
          </>)}
        </div>

        {isActive && isMuted && <p className="text-xs text-amber-400 mt-4 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-full"><MicOff className="w-3 h-3" /> الميكروفون مكتوم</p>}
        {!isActive && !canStart && (
          <button onClick={() => setSettingsOpen(true)}
            className="mt-6 text-xs text-amber-400 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl hover:bg-amber-500/15 transition-colors">
            <AlertCircle className="w-3.5 h-3.5" /> اضغط هنا لإعداد شخصية الوكيل ورسالة الترحيب
          </button>
        )}
        {error && <div className="mt-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"><WifiOff className="w-4 h-4 shrink-0" /> {error}</div>}
      </div>

      {/* ═══ TRANSCRIPT PANEL ═══ */}
      {transcriptOpen && (
        <div className={`h-56 border-t flex flex-col shrink-0 ${isDark ? 'border-[#1f1f23] bg-[#111113]' : 'border-gray-200 bg-white'}`}>
          <div className={`flex items-center justify-between px-5 py-2 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-100'}`}>
            <span className={`text-xs font-semibold tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>المحادثة</span>
            {transcript.length > 0 && <button onClick={() => setTranscript([])} className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500'} transition-colors`}><Trash2 className="w-3 h-3" /> مسح</button>}
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
            {transcript.length === 0 ? <p className={`text-sm text-center py-8 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>ابدأ مكالمة لرؤية المحادثة هنا</p>
            : transcript.map(e => (
              <div key={e.id} className={`flex gap-2.5 ${e.speaker==='user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  e.speaker==='agent' ? 'bg-cyan-500/10 text-cyan-400' : e.speaker==='user' ? 'bg-emerald-500/10 text-emerald-400' : isDark ? 'bg-[#1a1a1d] text-gray-600' : 'bg-gray-100 text-gray-400'
                }`}>{e.speaker==='agent' ? <Bot className="w-3 h-3" /> : e.speaker==='user' ? <Mic className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}</div>
                <div className={`max-w-[70%] ${e.speaker==='user' ? 'text-right' : ''}`}>
                  <p className={`inline-block text-sm leading-relaxed px-3 py-1.5 rounded-2xl ${
                    e.speaker==='agent' ? (isDark ? 'bg-[#1a1a1d] text-gray-200 rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tr-sm')
                    : e.speaker==='user' ? 'bg-teal-500/10 text-teal-100 rounded-tl-sm'
                    : (isDark ? 'text-gray-600' : 'text-gray-400') + ' text-xs italic'
                  }`}>{e.text}</p>
                  <span className={`text-[10px] block mt-0.5 px-1 ${isDark ? 'text-gray-700' : 'text-gray-400'}`}>{e.time}</span>
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}

      {/* ═══ SETTINGS DRAWER ═══ */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className={`w-96 max-w-[85vw] h-full overflow-y-auto ${isDark ? 'bg-[#111113] border-r border-[#1f1f23]' : 'bg-white border-r border-gray-200'}`}>
            <div className={`sticky top-0 z-10 backdrop-blur-md flex items-center justify-between px-5 py-4 border-b ${isDark ? 'bg-[#111113]/90 border-[#1f1f23]' : 'bg-white/90 border-gray-200'}`}>
              <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>إعدادات الوكيل</h2>
              <button onClick={() => setSettingsOpen(false)} className={`p-1.5 rounded-lg ${isDark ? 'text-gray-500 hover:text-white hover:bg-[#1a1a1d]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'} transition-colors`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5">
              <SG label="تحويل الكلام لنص" isDark={isDark}>
                <SS value={agentConfig.sttProvider} isDark={isDark} onChange={v => { const m={deepgram:'nova-2',openai:'whisper-1',elevenlabs:'scribe_v1'}; updateConfig(c=>({...c,sttProvider:v,sttModel:m[v]||'nova-2'})); }}
                  options={[{v:'deepgram',l:'Deepgram Nova-2'},{v:'elevenlabs',l:'ElevenLabs Scribe'},{v:'openai',l:'OpenAI Whisper'}]} />
              </SG>
              <SG label="لغة التعرف" isDark={isDark}>
                <SS value={agentConfig.sttLanguage} isDark={isDark} onChange={v=>updateConfig(c=>({...c,sttLanguage:v}))} options={[{v:'ar',l:'العربية'},{v:'en',l:'English'},{v:'multi',l:'تلقائي'}]} />
              </SG>
              <SG label="نموذج الذكاء" isDark={isDark}>
                <SS value={agentConfig.llmModel} isDark={isDark} onChange={v=>updateConfig(c=>({...c,llmModel:v}))} options={[{v:'gpt-5.4',l:'GPT-5.4 (الأذكى)'},{v:'gpt-5.4-mini',l:'GPT-5.4 Mini ⭐'},{v:'gpt-5.4-nano',l:'GPT-5.4 Nano'},{v:'gpt-4o',l:'GPT-4o'},{v:'gpt-4o-mini',l:'GPT-4o Mini'}]} />
              </SG>
              <SG label={`درجة الإبداع — ${agentConfig.llmTemperature}`} isDark={isDark}>
                <input type="range" min="0" max="1" step="0.1" value={agentConfig.llmTemperature} onChange={e=>updateConfig(c=>({...c,llmTemperature:parseFloat(e.target.value)}))} className="w-full accent-teal-500 h-1" />
                <div className={`flex justify-between text-[10px] mt-1 ${isDark?'text-gray-600':'text-gray-400'}`}><span>دقيق</span><span>إبداعي</span></div>
              </SG>
              <SG label="مزوّد الصوت" isDark={isDark}>
                <SS value={agentConfig.ttsProvider} isDark={isDark} onChange={v=>{const d={openai:{ttsModel:'tts-1',ttsVoice:'nova'},elevenlabs:{ttsModel:'eleven_turbo_v2_5',ttsVoice:'21m00Tcm4TlvDq8ikWAM'}};updateConfig(c=>({...c,ttsProvider:v,...d[v]}));}}
                  options={[{v:'openai',l:'OpenAI TTS'},{v:'elevenlabs',l:'ElevenLabs ⭐'}]} />
              </SG>
              <SG label="الصوت" isDark={isDark}>
                <SS value={agentConfig.ttsVoice} isDark={isDark} onChange={v=>updateConfig(c=>({...c,ttsVoice:v}))}
                  options={agentConfig.ttsProvider==='elevenlabs'?[{v:'21m00Tcm4TlvDq8ikWAM',l:'Rachel'},{v:'pNInz6obpgDQGcFmaJgB',l:'Adam'},{v:'AZnzlk1XvdvUeBnXmlld',l:'Domi'},{v:'TxGEqnHWrfWFTfGW9XjX',l:'Josh'},{v:'EXAVITQu4vr4xnSDxMaL',l:'Bella'}]:[{v:'nova',l:'Nova (أنثى)'},{v:'alloy',l:'Alloy'},{v:'echo',l:'Echo (ذكر)'},{v:'shimmer',l:'Shimmer'}]} />
              </SG>
              <SG label="جودة الصوت" isDark={isDark}>
                <SS value={agentConfig.ttsModel} isDark={isDark} onChange={v=>updateConfig(c=>({...c,ttsModel:v}))}
                  options={agentConfig.ttsProvider==='elevenlabs'?[{v:'eleven_turbo_v2_5',l:'Turbo v2.5 ⭐'},{v:'eleven_multilingual_v2',l:'Multilingual v2'},{v:'eleven_flash_v2_5',l:'Flash v2.5'}]:[{v:'tts-1',l:'عادي (أسرع)'},{v:'tts-1-hd',l:'HD'}]} />
              </SG>
              <div className={`pt-4 border-t ${isDark?'border-[#1f1f23]':'border-gray-200'}`}>
                <SG label="شخصية الوكيل *" isDark={isDark}>
                  <textarea rows={5} value={agentConfig.systemPrompt} onChange={e=>updateConfig(c=>({...c,systemPrompt:e.target.value}))} placeholder="أنت مساعدة ذكية تعمل في..."
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isDark?'bg-[#0a0a0b] border border-[#1f1f23] text-white placeholder:text-gray-600':'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400'}`} dir="rtl" />
                </SG>
              </div>
              <SG label="رسالة الترحيب *" isDark={isDark}>
                <input type="text" value={agentConfig.greeting} onChange={e=>updateConfig(c=>({...c,greeting:e.target.value}))} placeholder="أهلاً وسهلاً، كيف أقدر أساعدك؟"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isDark?'bg-[#0a0a0b] border border-[#1f1f23] text-white placeholder:text-gray-600':'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400'}`} dir="rtl" />
              </SG>
              <div className={`flex items-start gap-2 p-3 rounded-xl ${isDark?'bg-teal-500/5 border border-teal-500/15':'bg-teal-50 border border-teal-200'}`}>
                <Sparkles className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <p className={`text-xs leading-relaxed ${isDark?'text-teal-400/80':'text-teal-700'}`}>
                  {configDirty ? 'عدّلت الإعدادات — ستُستخدم في المكالمة القادمة. اضغط "حفظ على المساعد" لحفظها نهائياً.' : 'الإعدادات تنتقل مباشرة للوكيل عند بدء المكالمة.'}
                </p>
              </div>
              {/* ── Save to Agent button (only in agent mode + dirty) ── */}
              {agentMode && configDirty && (
                <button onClick={handleSaveToAgent} disabled={saving}
                  className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    saving ? 'bg-amber-500/20 text-amber-400 cursor-wait' : 'bg-amber-500 hover:bg-amber-400 text-white'
                  }`}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'جاري الحفظ...' : 'حفظ على المساعد'}
                </button>
              )}
              {/* ── Saved confirmation ── */}
              {savedMsg && (
                <div className={`text-center text-sm font-medium py-2 rounded-xl ${
                  savedMsg.includes('✓') ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                }`}>
                  {savedMsg}
                </div>
              )}
              {/* ── Close drawer ── */}
              <button onClick={() => setSettingsOpen(false)} disabled={!canStart}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-teal-500 hover:bg-teal-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                {canStart ? 'إغلاق' : 'اكمل الحقول المطلوبة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SG({ label, isDark, children }) {
  return <div><label className={`block text-xs font-medium mb-1.5 ${isDark?'text-gray-400':'text-gray-500'}`}>{label}</label>{children}</div>;
}
function SS({ value, onChange, options, isDark }) {
  return <select value={value} onChange={e=>onChange(e.target.value)} className={`w-full appearance-none rounded-xl px-3.5 py-2.5 pe-8 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isDark?'bg-[#0a0a0b] border border-[#1f1f23] text-white':'bg-gray-50 border border-gray-200 text-gray-900'}`}>
    {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
  </select>;
}