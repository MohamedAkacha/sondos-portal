import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import leadAPI from '@/services/api/leadAPI';
import { ArrowLeft, Save, Phone, Mail, Building, User, Loader2 } from 'lucide-react';
const STATUSES = ['new','contacted','qualified','converted','lost'];
const STATUS_COLORS = { new:'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', contacted:'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', qualified:'bg-purple-500/10 text-purple-400 border-purple-500/20', converted:'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', lost:'bg-red-500/10 text-red-400 border-red-500/20' };
export default function LeadDetailPage() {
  const { id } = useParams(); const { t } = useLanguage(); const { isDark } = useTheme(); const navigate = useNavigate();
  const [lead, setLead] = useState(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [form, setForm] = useState({});
  useEffect(() => { (async () => { try { setLoading(true); const res = await leadAPI.getById(id); const d = res.data?.data; setLead(d); setForm(d); } catch(e){console.error(e)} finally{setLoading(false)} })(); }, [id]);
  const handleSave = async () => { try { setSaving(true); const res = await leadAPI.update(id, { name:form.name, phone:form.phone, email:form.email, company:form.company, notes:form.notes }); setLead(res.data?.data); } catch(e){alert(e.message)} finally{setSaving(false)} };
  const handleStatus = async (s) => { try { const res = await leadAPI.updateStatus(id, s); setLead(res.data?.data); setForm(p=>({...p,status:s})); } catch(e){console.error(e)} };
  const card = isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900'; const textSec = isDark ? 'text-gray-400' : 'text-gray-600'; const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const inputCls = `w-full rounded-xl px-4 py-2.5 border focus:border-teal-500 focus:outline-none ${isDark ? 'bg-[#1a1a1d] border-[#27272a] text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className={`animate-spin ${textSec}`} size={32}/></div>;
  if (!lead) return <div className={`p-6 text-center ${textSec}`}>{t('common.noData')}</div>;
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/leads')} className={`p-2 rounded-lg ${isDark?'hover:bg-[#1a1a1d]':'hover:bg-gray-100'}`}><ArrowLeft size={20} className={textSec}/></button>
          <div><h1 className={`text-2xl font-bold ${text}`}>{lead.name||t('leads.fields.name')}</h1><span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[lead.status]}`}>{t(`leads.statuses.${lead.status}`)}</span></div>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 text-white font-bold rounded-xl transition">
          {saving?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>} {t('common.save')}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <section className={`rounded-2xl p-6 border ${card}`}>
            <h2 className={`text-lg font-semibold mb-4 ${text}`}>بيانات العميل</h2>
            <div className="grid gap-4">
              {[{icon:User,key:'name',ph:t('leads.fields.name')},{icon:Phone,key:'phone',ph:t('leads.fields.phone'),dir:'ltr'},{icon:Mail,key:'email',ph:t('leads.fields.email'),dir:'ltr'},{icon:Building,key:'company',ph:t('leads.fields.company')}].map(f=>(
                <div key={f.key} className="flex items-center gap-3"><f.icon size={18} className={textMuted}/><input value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} className={inputCls} placeholder={f.ph} dir={f.dir}/></div>
              ))}
            </div>
          </section>
          <section className={`rounded-2xl p-6 border ${card}`}>
            <h2 className={`text-lg font-semibold mb-4 ${text}`}>{t('leads.fields.notes')}</h2>
            <textarea value={form.notes||''} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={5} className={`${inputCls} resize-none`} placeholder={t('leads.fields.notes')}/>
          </section>
        </div>
        <div className="space-y-6">
          <section className={`rounded-2xl p-6 border ${card}`}>
            <h2 className={`text-sm font-semibold mb-3 ${textMuted}`}>{t('leads.fields.status')}</h2>
            <div className="space-y-2">{STATUSES.map(s=>(
              <button key={s} onClick={()=>handleStatus(s)} className={`w-full text-start px-3 py-2 rounded-xl text-sm transition ${form.status===s?STATUS_COLORS[s]+' border font-medium':isDark?'text-gray-400 hover:bg-[#1a1a1d]':'text-gray-600 hover:bg-gray-50'}`}>{t(`leads.statuses.${s}`)}</button>
            ))}</div>
          </section>
          <section className={`rounded-2xl p-6 border ${card}`}>
            <h2 className={`text-sm font-semibold mb-3 ${textMuted}`}>{t('common.details')}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className={textMuted}>{t('leads.fields.source')}</span><span className={text}>{t(`leads.sources.${lead.source}`)}</span></div>
              <div className="flex items-center justify-between"><span className={textMuted}>{t('common.date')}</span><span className={text}>{new Date(lead.createdAt).toLocaleDateString('ar-SA')}</span></div>
              <div className="flex items-center justify-between"><span className={textMuted}>عدد التواصلات</span><span className={text}>{lead.contactCount}</span></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
