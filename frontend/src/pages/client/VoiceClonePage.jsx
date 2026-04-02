// =====================================================
// Voice Clone Page — استنساخ الصوت
// ─────────────────────────────────────────────────────
// Record from mic or upload audio → Clone via ElevenLabs
// Lists cloned voices with delete option
// =====================================================
import { useState, useEffect, useRef } from "react";
import {
  Mic, MicOff, Upload, Trash2, Loader2, CheckCircle, AlertCircle,
  Play, Square, Volume2, Clock, Info,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getElevenLabsVoices, cloneVoice, deleteVoice } from "@/services/api/agentAPI";

const MAX_RECORD_SECONDS = 120; // 2 minutes

export default function VoiceClonePage() {
  const { isDark } = useTheme();

  // ── Cloned voices list ──
  const [clonedVoices, setClonedVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(true);

  // ── Clone form ──
  const [voiceName, setVoiceName] = useState('');
  const [audioFile, setAudioFile] = useState(null);       // File from upload
  const [recordedBlob, setRecordedBlob] = useState(null);  // Blob from mic
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState(null);    // { success, message }

  // ── Recording state ──
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // ── Preview playback ──
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  // ── Deleting ──
  const [deletingId, setDeletingId] = useState(null);

  // ── Load cloned voices ──
  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      const res = await getElevenLabsVoices();
      const cloned = (res.voices || []).filter(v => v.category === 'cloned');
      setClonedVoices(cloned);
    } catch (err) {
      console.error('Failed to load voices:', err);
    } finally {
      setLoadingVoices(false);
    }
  };

  // ══════════════════════════════════════════════════════
  // Recording from microphone
  // ══════════════════════════════════════════════════════
  const startRecording = async () => {
    try {
      setRecordedBlob(null);
      setAudioFile(null);
      setCloneResult(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(1000); // collect data every 1s
      setRecording(true);
      setRecordSeconds(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => {
          if (prev >= MAX_RECORD_SECONDS - 1) {
            stopRecording();
            return MAX_RECORD_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Mic access denied:', err);
      setCloneResult({ success: false, message: 'لا يمكن الوصول للميكروفون — تأكد من السماح بالوصول' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  // ══════════════════════════════════════════════════════
  // File upload
  // ══════════════════════════════════════════════════════
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setRecordedBlob(null);
    setCloneResult(null);
  };

  // ══════════════════════════════════════════════════════
  // Clone
  // ══════════════════════════════════════════════════════
  const handleClone = async () => {
    const source = recordedBlob || audioFile;
    if (!source) {
      setCloneResult({ success: false, message: 'يرجى تسجيل أو رفع ملف صوتي أولاً' });
      return;
    }
    if (!voiceName.trim()) {
      setCloneResult({ success: false, message: 'يرجى كتابة اسم للصوت' });
      return;
    }

    setCloning(true);
    setCloneResult(null);

    try {
      const formData = new FormData();
      formData.append('name', voiceName.trim());
      formData.append('language', 'ar');

      if (recordedBlob) {
        formData.append('files', recordedBlob, 'recording.webm');
      } else {
        formData.append('files', audioFile, audioFile.name);
      }

      const res = await cloneVoice(formData);
      setCloneResult({ success: true, message: `تم استنساخ الصوت بنجاح — ${res.voice_id}` });

      // Reset form
      setVoiceName('');
      setRecordedBlob(null);
      setAudioFile(null);
      setRecordSeconds(0);

      // Reload voices
      await loadVoices();
    } catch (err) {
      setCloneResult({ success: false, message: err.message || 'فشل استنساخ الصوت' });
    } finally {
      setCloning(false);
    }
  };

  // ══════════════════════════════════════════════════════
  // Delete
  // ══════════════════════════════════════════════════════
  const handleDelete = async (voiceId, voiceName) => {
    if (!confirm(`حذف الصوت "${voiceName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    setDeletingId(voiceId);
    try {
      await deleteVoice(voiceId);
      await loadVoices();
    } catch (err) {
      alert(err.message || 'فشل حذف الصوت');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Helpers ──
  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const hasAudio = !!recordedBlob || !!audioFile;
  const audioLabel = recordedBlob ? `تسجيل (${formatTime(recordSeconds)})` : audioFile ? audioFile.name : '';

  return (
    <div className="max-w-3xl mx-auto py-6 px-4" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          🎤 استنساخ الصوت
        </h1>
        <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          سجّل صوتك أو ارفع ملف صوتي لإنشاء نسخة ذكية تستخدمها في مساعدينك
        </p>
      </div>

      {/* ═══ Instructions ═══ */}
      <div className={`p-4 rounded-xl border mb-6 ${isDark ? 'bg-teal-500/5 border-teal-500/20' : 'bg-teal-50 border-teal-200'}`}>
        <div className="flex items-start gap-2">
          <Info className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          <div className={`text-sm space-y-1 ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
            <p className="font-medium">نصائح للحصول على أفضل نتيجة:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs opacity-80">
              <li>سجّل في مكان هادئ بدون ضوضاء خلفية</li>
              <li>تكلّم بنبرة طبيعية وثابتة — لا تغيّر سرعتك أو نبرتك</li>
              <li>مدة 1-2 دقيقة كافية (لا تزيد عن دقيقتين)</li>
              <li>تأكد إن الميكروفون قريب ومباشر</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ═══ Clone Form ═══ */}
      <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#0d0d0f] border-[#1f1f23]' : 'bg-white border-gray-200'}`}>

        {/* Voice name */}
        <div className="mb-5">
          <label className={`text-sm font-medium block mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            اسم الصوت *
          </label>
          <input
            type="text"
            value={voiceName}
            onChange={e => setVoiceName(e.target.value)}
            placeholder="مثال: صوتي الشخصي"
            className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
              isDark ? 'bg-[#0a0a0b] border border-[#1f1f23] text-white placeholder:text-gray-600' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400'
            }`}
            dir="rtl"
          />
        </div>

        {/* Record or Upload */}
        <div className="mb-5">
          <label className={`text-sm font-medium block mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            مصدر الصوت *
          </label>

          <div className="flex gap-3">
            {/* Record button */}
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={cloning}
              className={`flex-1 flex flex-col items-center gap-2 p-5 rounded-xl border transition-all ${
                recording
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : recordedBlob
                    ? 'bg-teal-500/10 border-teal-500/30'
                    : isDark ? 'border-[#1f1f23] hover:border-[#2a2a2e]' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {recording ? (
                <>
                  <div className="relative">
                    <Square className="w-8 h-8 text-red-400" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  </div>
                  <span className="text-sm font-medium">إيقاف التسجيل</span>
                  <span className="text-lg font-mono text-red-400">{formatTime(recordSeconds)}</span>
                </>
              ) : (
                <>
                  <Mic className={`w-8 h-8 ${recordedBlob ? 'text-teal-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {recordedBlob ? `✓ تم التسجيل (${formatTime(recordSeconds)})` : 'سجّل من الميكروفون'}
                  </span>
                </>
              )}
            </button>

            {/* Upload button */}
            <label className={`flex-1 flex flex-col items-center gap-2 p-5 rounded-xl border transition-all cursor-pointer ${
              audioFile
                ? 'bg-teal-500/10 border-teal-500/30'
                : isDark ? 'border-[#1f1f23] hover:border-[#2a2a2e]' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <Upload className={`w-8 h-8 ${audioFile ? 'text-teal-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              <span className={`text-sm font-medium text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {audioFile ? `✓ ${audioFile.name}` : 'ارفع ملف صوتي'}
              </span>
              <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>MP3, WAV, WebM</span>
              <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" disabled={cloning || recording} />
            </label>
          </div>
        </div>

        {/* Clone button */}
        <button
          onClick={handleClone}
          disabled={cloning || !hasAudio || !voiceName.trim()}
          className={`w-full py-3.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            cloning || !hasAudio || !voiceName.trim()
              ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
              : 'bg-teal-500 text-white hover:bg-teal-600 active:scale-[0.98]'
          }`}
        >
          {cloning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري استنساخ الصوت...
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              استنسخ الصوت
            </>
          )}
        </button>

        {/* Result message */}
        {cloneResult && (
          <div className={`mt-4 p-3 rounded-xl border text-sm flex items-center gap-2 ${
            cloneResult.success
              ? isDark ? 'bg-green-500/5 border-green-500/20 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
              : isDark ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {cloneResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {cloneResult.message}
          </div>
        )}
      </div>

      {/* ═══ Cloned Voices List ═══ */}
      <div className="mt-8">
        <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          أصواتك المستنسخة
        </h2>

        {loadingVoices ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>جاري التحميل...</span>
          </div>
        ) : clonedVoices.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
            <Mic className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              لم تستنسخ أي صوت بعد — سجّل صوتك أعلاه للبدء
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <audio ref={audioRef} className="hidden" />
            {clonedVoices.map(v => (
              <div
                key={v.voice_id}
                className={`flex items-center gap-3 p-4 rounded-xl border ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}
              >
                {/* Play preview */}
                {v.preview_url && (
                  <button
                    onClick={() => {
                      if (playingId === v.voice_id) {
                        audioRef.current?.pause();
                        setPlayingId(null);
                      } else {
                        if (audioRef.current) { audioRef.current.src = v.preview_url; audioRef.current.play(); }
                        setPlayingId(v.voice_id);
                        if (audioRef.current) audioRef.current.onended = () => setPlayingId(null);
                      }
                    }}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      playingId === v.voice_id ? 'bg-teal-500 text-white' : isDark ? 'bg-[#1a1a1d] text-gray-400 hover:text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {playingId === v.voice_id ? <Volume2 className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{v.name}</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {v.voice_id}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(v.voice_id, v.name)}
                  disabled={deletingId === v.voice_id}
                  className={`shrink-0 p-2 rounded-lg transition-all ${
                    isDark ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                >
                  {deletingId === v.voice_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
