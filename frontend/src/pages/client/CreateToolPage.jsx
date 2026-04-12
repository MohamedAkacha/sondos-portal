import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import toolAPI from '@/services/api/toolAPI';
import { ArrowLeft, Plus, Trash2, Play, Check, X, Loader2 } from 'lucide-react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const PARAM_TYPES = ['string', 'number', 'boolean', 'date', 'enum'];

export default function CreateToolPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [form, setForm] = useState({
    name: '',
    functionName: '',
    description: '',
    parameters: [],
    httpConfig: {
      url: '',
      method: 'POST',
      headers: [],
      bodyTemplate: '',
      timeout: 5000,
      retries: 1,
      responsePath: '',
    },
    behavior: {
      waitingMessage: t('tools.behavior.waitingMessageDefault'),
      failureMessage: t('tools.behavior.failureMessageDefault'),
      confirmBeforeExecute: false,
    },
  });

  const [testParams, setTestParams] = useState({});

  // Auto-generate functionName from name
  const handleNameChange = (name) => {
    const fn = name.toLowerCase().replace(/[\s\u0600-\u06FF]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/^_+|_+$/g, '') || '';
    setForm(prev => ({ ...prev, name, functionName: fn }));
  };

  const updateField = (path, value) => {
    setForm(prev => {
      const copy = { ...prev };
      const keys = path.split('.');
      let obj = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  // ── Parameters ──
  const addParam = () => {
    setForm(prev => ({
      ...prev,
      parameters: [...prev.parameters, { name: '', type: 'string', description: '', required: true, enumValues: [] }],
    }));
  };

  const updateParam = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      parameters: prev.parameters.map((p, i) => i === index ? { ...p, [field]: value } : p),
    }));
  };

  const removeParam = (index) => {
    setForm(prev => ({ ...prev, parameters: prev.parameters.filter((_, i) => i !== index) }));
  };

  // ── Headers ──
  const addHeader = () => {
    updateField('httpConfig.headers', [...form.httpConfig.headers, { key: '', value: '' }]);
  };

  const updateHeader = (index, field, value) => {
    const headers = [...form.httpConfig.headers];
    headers[index] = { ...headers[index], [field]: value };
    updateField('httpConfig.headers', headers);
  };

  const removeHeader = (index) => {
    updateField('httpConfig.headers', form.httpConfig.headers.filter((_, i) => i !== index));
  };

  // ── Save ──
  const handleSave = async () => {
    if (!form.name || !form.functionName || !form.description || !form.httpConfig.url) return;
    try {
      setSaving(true);
      await toolAPI.create(form);
      navigate('/tools');
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  // ── Test ──
  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      // Save first, then test
      const createRes = await toolAPI.create(form);
      const toolId = createRes.data.data.id;
      const res = await toolAPI.test(toolId, testParams);
      setTestResult(res.data.data);
    } catch (err) {
      setTestResult({ success: false, error: err.response?.data?.message || err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/tools')} className="p-2 hover:bg-white/10 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">{t('tools.createTool')}</h1>
      </div>

      <div className="space-y-8">
        {/* ═══ Section 1: Definition ═══ */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">{t('tools.toolName')}</h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('tools.toolName')}</label>
              <input value={form.name} onChange={e => handleNameChange(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
                placeholder="التحقق من المواعيد المتاحة" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('tools.functionName')}</label>
              <input value={form.functionName} onChange={e => updateField('functionName', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 font-mono text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="check_availability" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('tools.description')}</label>
              <textarea value={form.description} onChange={e => updateField('description', e.target.value)} rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none resize-none"
                placeholder={t('tools.descriptionHint')} />
            </div>
          </div>
        </section>

        {/* ═══ Section 2: Parameters ═══ */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('tools.parameters.title')}</h2>
            <button onClick={addParam} className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300">
              <Plus size={16} /> {t('tools.parameters.add')}
            </button>
          </div>
          {form.parameters.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('tools.parameters.add')}</p>
          ) : (
            <div className="space-y-3">
              {form.parameters.map((param, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start bg-white/5 p-3 rounded-lg">
                  <input value={param.name} onChange={e => updateParam(i, 'name', e.target.value)} placeholder={t('tools.parameters.name')}
                    className="col-span-3 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none" dir="ltr" />
                  <select value={param.type} onChange={e => updateParam(i, 'type', e.target.value)}
                    className="col-span-2 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                    {PARAM_TYPES.map(pt => <option key={pt} value={pt}>{t(`tools.parameters.types.${pt}`)}</option>)}
                  </select>
                  <input value={param.description} onChange={e => updateParam(i, 'description', e.target.value)} placeholder={t('tools.parameters.paramDescription')}
                    className="col-span-4 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                  <label className="col-span-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={param.required} onChange={e => updateParam(i, 'required', e.target.checked)}
                      className="rounded border-white/20" />
                    {t('tools.parameters.required')}
                  </label>
                  <button onClick={() => removeParam(i)} className="col-span-1 p-2 text-red-400 hover:bg-red-500/20 rounded">
                    <Trash2 size={16} />
                  </button>
                  {param.type === 'enum' && (
                    <input value={(param.enumValues || []).join(', ')} onChange={e => updateParam(i, 'enumValues', e.target.value.split(',').map(v => v.trim()))}
                      placeholder={t('tools.parameters.enumValues')}
                      className="col-span-12 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ═══ Section 3: HTTP Config ═══ */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">{t('tools.http.title')}</h2>
          <div className="grid gap-4">
            <div className="flex gap-2">
              <select value={form.httpConfig.method} onChange={e => updateField('httpConfig.method', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 font-mono text-sm focus:border-indigo-500 focus:outline-none">
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input value={form.httpConfig.url} onChange={e => updateField('httpConfig.url', e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 font-mono text-sm focus:border-indigo-500 focus:outline-none"
                placeholder={t('tools.http.urlPlaceholder')} dir="ltr" />
            </div>

            {/* Headers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">{t('tools.http.headers')}</label>
                <button onClick={addHeader} className="text-xs text-indigo-400 hover:text-indigo-300">{t('tools.http.addHeader')}</button>
              </div>
              {form.httpConfig.headers.map((h, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} placeholder={t('tools.http.headerKey')}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none" dir="ltr" />
                  <input value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} placeholder={t('tools.http.headerValue')}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none" dir="ltr" />
                  <button onClick={() => removeHeader(i)} className="p-2 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            {/* Body Template */}
            {form.httpConfig.method !== 'GET' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('tools.http.bodyTemplate')}</label>
                <textarea value={form.httpConfig.bodyTemplate} onChange={e => updateField('httpConfig.bodyTemplate', e.target.value)} rows={5}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 font-mono text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  placeholder={'{\n  "date": "{{date}}",\n  "service": "{{service}}"\n}'} dir="ltr" />
                <p className="text-xs text-gray-500 mt-1">{t('tools.http.bodyHint')}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('tools.http.responseMapping')}</label>
                <input value={form.httpConfig.responsePath} onChange={e => updateField('httpConfig.responsePath', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 font-mono text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="data.available_slots" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('tools.http.timeout')}</label>
                <input type="number" value={form.httpConfig.timeout} onChange={e => updateField('httpConfig.timeout', parseInt(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
                  min={1000} max={30000} step={1000} />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Section 4: Behavior ═══ */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">{t('tools.behavior.title')}</h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('tools.behavior.waitingMessage')}</label>
              <input value={form.behavior.waitingMessage} onChange={e => updateField('behavior.waitingMessage', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('tools.behavior.failureMessage')}</label>
              <input value={form.behavior.failureMessage} onChange={e => updateField('behavior.failureMessage', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
        </section>

        {/* ═══ Section 5: Test ═══ */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">{t('tools.test.title')}</h2>
          {form.parameters.length > 0 && (
            <div className="grid gap-3 mb-4">
              {form.parameters.map((param, i) => (
                <div key={i}>
                  <label className="block text-sm text-gray-400 mb-1">{param.name} ({param.type})</label>
                  <input value={testParams[param.name] || ''} onChange={e => setTestParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
                    placeholder={param.description} />
                </div>
              ))}
            </div>
          )}
          <button onClick={handleTest} disabled={testing || !form.httpConfig.url}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition">
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {t('tools.test.run')}
          </button>
          {testResult && (
            <div className={`mt-4 p-4 rounded-lg border ${testResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.success ? <Check size={18} className="text-green-400" /> : <X size={18} className="text-red-400" />}
                <span className="font-medium">{testResult.success ? t('tools.test.success') : t('tools.test.failed')}</span>
                {testResult.responseTime && <span className="text-sm text-gray-400">({testResult.responseTime}ms)</span>}
              </div>
              <pre className="text-xs bg-black/30 p-3 rounded overflow-auto max-h-48 mt-2" dir="ltr">
                {JSON.stringify(testResult.data || testResult.error, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* ═══ Actions ═══ */}
        <div className="flex items-center justify-end gap-3">
          <button onClick={() => navigate('/tools')} className="px-6 py-2.5 border border-white/10 rounded-lg hover:bg-white/5 transition">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.functionName || !form.description || !form.httpConfig.url}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition">
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
