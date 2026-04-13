import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { Copy, Check, Code, Eye, Palette, MessageSquare, Globe, Loader2 } from 'lucide-react';

export default function WidgetSetupPage() {
  const { t, isAr } = useLanguage();
  const { isDark } = useTheme();

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState({
    language: 'ar',
    position: 'bottom-right',
    primaryColor: '#14b8a6',
    title: 'سندس AI',
    greeting: '',
  });

  useEffect(() => { loadAgents(); }, []);

  const loadAgents = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAgents(data.data || data.agents || []);
      if (data.data?.[0]) setSelectedAgent(data.data[0].id || data.data[0]._id);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const apiUrl = window.location.origin;

  const embedCode = `<script src="${apiUrl}/widget/sondos-chat.js"><\/script>
<script>
  SondosChat.init({
    agentId: "${selectedAgent}",
    apiUrl: "${apiUrl}",
    language: "${config.language}",
    position: "${config.position}",
    primaryColor: "${config.primaryColor}",
    title: "${config.title}",
  });
<\/script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cardClass = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const inputClass = isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900';
  const labelClass = isDark ? 'text-gray-400' : 'text-gray-600';

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className={`animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} size={32} /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl flex items-center justify-center">
          <MessageSquare size={20} className="text-white" />
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>إعداد ودجت الدردشة</h1>
          <p className={`text-sm ${labelClass}`}>أضف محادثة ذكية لموقعك بسطر كود واحد</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="space-y-6">
          {/* Agent Selection */}
          <div className={`rounded-2xl p-6 border ${cardClass}`}>
            <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>اختر المساعد</h3>
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
              className={`w-full rounded-xl px-4 py-3 border ${inputClass}`}>
              {agents.map(a => (
                <option key={a.id || a._id} value={a.id || a._id}>{a.name} {a.avatar}</option>
              ))}
            </select>
          </div>

          {/* Customization */}
          <div className={`rounded-2xl p-6 border ${cardClass}`}>
            <h3 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Palette size={18} className="text-teal-400" /> التخصيص
            </h3>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${labelClass}`}>اللغة</label>
                <select value={config.language} onChange={e => setConfig(p => ({ ...p, language: e.target.value }))}
                  className={`w-full rounded-xl px-4 py-2.5 border ${inputClass}`}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm mb-1 ${labelClass}`}>الموضع</label>
                <select value={config.position} onChange={e => setConfig(p => ({ ...p, position: e.target.value }))}
                  className={`w-full rounded-xl px-4 py-2.5 border ${inputClass}`}>
                  <option value="bottom-right">أسفل يمين</option>
                  <option value="bottom-left">أسفل يسار</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm mb-1 ${labelClass}`}>اللون الرئيسي</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={config.primaryColor} onChange={e => setConfig(p => ({ ...p, primaryColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                  <input value={config.primaryColor} onChange={e => setConfig(p => ({ ...p, primaryColor: e.target.value }))}
                    className={`flex-1 rounded-xl px-4 py-2.5 border font-mono text-sm ${inputClass}`} dir="ltr" />
                </div>
              </div>

              <div>
                <label className={`block text-sm mb-1 ${labelClass}`}>العنوان</label>
                <input value={config.title} onChange={e => setConfig(p => ({ ...p, title: e.target.value }))}
                  className={`w-full rounded-xl px-4 py-2.5 border ${inputClass}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Code + Preview */}
        <div className="space-y-6">
          {/* Embed Code */}
          <div className={`rounded-2xl p-6 border ${cardClass}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Code size={18} className="text-teal-400" /> كود التضمين
              </h3>
              <button onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-teal-400 to-cyan-500 text-white rounded-lg text-sm">
                {copied ? <><Check size={14} /> تم النسخ</> : <><Copy size={14} /> نسخ</>}
              </button>
            </div>
            <pre className={`text-sm p-4 rounded-xl overflow-x-auto font-mono leading-relaxed ${isDark ? 'bg-[#0a0a0b] text-gray-300' : 'bg-gray-100 text-gray-700'}`} dir="ltr">
              {embedCode}
            </pre>
            <p className={`text-xs mt-3 ${labelClass}`}>
              أضف هذا الكود قبل <code dir="ltr">&lt;/body&gt;</code> في أي صفحة HTML
            </p>
          </div>

          {/* Preview */}
          <div className={`rounded-2xl p-6 border ${cardClass}`}>
            <h3 className={`font-semibold flex items-center gap-2 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Eye size={18} className="text-teal-400" /> معاينة
            </h3>
            <div className={`relative rounded-xl overflow-hidden h-72 ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-100'}`}>
              {/* Fake website background */}
              <div className="p-4 space-y-2">
                <div className={`h-4 rounded w-3/4 ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-200'}`} />
                <div className={`h-4 rounded w-1/2 ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-200'}`} />
                <div className={`h-4 rounded w-2/3 ${isDark ? 'bg-[#1a1a1d]' : 'bg-gray-200'}`} />
              </div>

              {/* Widget bubble */}
              <div className="absolute" style={{ [config.position === 'bottom-left' ? 'left' : 'right']: 16, bottom: 16 }}>
                <div className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-2xl cursor-pointer"
                  style={{ backgroundColor: config.primaryColor }}>
                  💬
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
