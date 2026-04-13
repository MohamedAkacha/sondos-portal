import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Users, Phone, BookOpen, Link2, Settings, LogOut, Zap, Bot,
  CreditCard, Mic, Crown, Smartphone, PhoneOutgoing, Wrench,
  MessageSquare, Activity, Receipt, UserCheck, Radio, Key, Webhook,
  Code, Brain, FileSearch, ChevronDown, Megaphone
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';

// ── Navigation Structure: 1 standalone + 7 groups ──
const NAV_GROUPS = [
  {
    id: 'calls',
    label: 'المكالمات والمحادثات',
    icon: Phone,
    items: [
      { path: '/calls', icon: Phone, label: 'سجل المكالمات' },
      { path: '/live-calls', icon: Radio, label: 'المكالمات الحية' },
      { path: '/chat', icon: MessageSquare, label: 'الدردشة' },
      { path: '/handoff', icon: UserCheck, label: 'التحويل لموظف' },
    ],
  },
  {
    id: 'agents',
    label: 'المساعدين',
    icon: Bot,
    items: [
      { path: '/agents', icon: Bot, label: 'قائمة المساعدين' },
      { path: '/test-agent', icon: Mic, label: 'اختبار المساعد' },
    ],
  },
  {
    id: 'leads',
    label: 'العملاء',
    icon: Users,
    items: [
      { path: '/leads', icon: Users, label: 'العملاء المحتملين' },
      { path: '/extractions', icon: FileSearch, label: 'المتغيرات المستخرجة' },
      { path: '/memory', icon: Brain, label: 'ذاكرة المحادثات' },
    ],
  },
  {
    id: 'tools',
    label: 'الأدوات والمعرفة',
    icon: Wrench,
    items: [
      { path: '/tools', icon: Wrench, label: 'الأدوات' },
      { path: '/knowledge', icon: BookOpen, label: 'قواعد المعرفة' },
    ],
  },
  {
    id: 'campaigns',
    label: 'الحملات والأرقام',
    icon: Megaphone,
    items: [
      { path: '/campaigns', icon: PhoneOutgoing, label: 'الحملات' },
      { path: '/phones', icon: Smartphone, label: 'أرقام الهاتف' },
      { path: '/voice-clone', icon: Mic, label: 'استنساخ الصوت' },
    ],
  },
  {
    id: 'analytics',
    label: 'التحليلات والفوترة',
    icon: Activity,
    items: [
      { path: '/analytics', icon: Activity, label: 'التحليلات' },
      { path: '/usage', icon: Receipt, label: 'الاستخدام والفوترة' },
    ],
  },
  {
    id: 'settings',
    label: 'الإعدادات والمطورين',
    icon: Settings,
    items: [
      { path: '/settings', icon: Settings, label: 'الإعدادات' },
      { path: '/widget-setup', icon: Code, label: 'ودجت الدردشة' },
      { path: '/api-keys', icon: Key, label: 'مفاتيح API' },
      { path: '/webhooks', icon: Webhook, label: 'Webhooks' },
      { path: '/integrations', icon: Link2, label: 'التكاملات' },
      { path: '/payment', icon: CreditCard, label: 'الدفع' },
      { path: '/my-plan', icon: Crown, label: 'باقتي' },
    ],
  },
];

function findGroupForPath(pathname) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)) {
        return group.id;
      }
    }
  }
  return null;
}

export default function Sidebar({ onLogout, user }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [openGroup, setOpenGroup] = useState(() => findGroupForPath(location.pathname));

  useEffect(() => {
    const group = findGroupForPath(location.pathname);
    if (group) setOpenGroup(group);
  }, [location.pathname]);

  const toggleGroup = (id) => setOpenGroup(prev => prev === id ? null : id);

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const isGroupActive = (group) =>
    group.items.some(item => isActive(item.path));

  const userName = user?.name || user?.companyName || user?.email?.split('@')[0] || t('sidebar.defaultUser');
  const userPlan = user?.plan || user?.subscription?.plan || 'basic';
  const userInitial = userName.charAt(0).toUpperCase();
  const planNames = {
    free: t('sidebar.planFree'), basic: t('sidebar.planBasic'), starter: t('sidebar.planBasic'),
    professional: t('sidebar.planPro'), pro: t('sidebar.planPro'),
    enterprise: t('sidebar.planEnterprise'), business: t('sidebar.planBusiness'),
  };
  const displayPlan = planNames[userPlan?.toLowerCase()] || userPlan;

  // Design tokens (matching old design system)
  const border = isDark ? 'border-[#1f1f23]' : 'border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const hoverBg = isDark ? 'hover:bg-[#1a1a1d]' : 'hover:bg-gray-100';

  return (
    <aside className={`w-72 h-screen sticky top-0 border-l flex flex-col transition-colors duration-300 ${
      isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'
    }`}>
      {/* ── Logo ── */}
      <div className={`p-6 border-b shrink-0 ${border}`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className={`text-xl font-bold ${text}`}>Sondos AI</span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {/* Overview — standalone */}
        <button
          onClick={() => navigate('/')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isActive('/')
              ? 'bg-teal-500/10 text-teal-500 border border-teal-500/20'
              : `${textSec} ${hoverBg} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
          }`}
        >
          <Home className="w-5 h-5 shrink-0" />
          <span className="font-medium">{t('sidebar.overview')}</span>
        </button>

        {/* Divider */}
        <div className={`my-2 border-t ${border}`} />

        {/* Groups */}
        {NAV_GROUPS.map(group => {
          const isOpen = openGroup === group.id;
          const hasActive = isGroupActive(group);

          return (
            <div key={group.id} className="space-y-0.5">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all ${
                  hasActive
                    ? (isDark ? 'text-teal-400' : 'text-teal-600')
                    : `${textSec} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
                } ${hoverBg}`}
              >
                <div className="flex items-center gap-3">
                  <group.icon className="w-5 h-5 shrink-0" />
                  <span className="font-medium text-sm">{group.label}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Group Items */}
              <div
                className="overflow-hidden transition-all duration-200 ease-in-out"
                style={{
                  maxHeight: isOpen ? `${group.items.length * 40 + 8}px` : '0px',
                  opacity: isOpen ? 1 : 0,
                }}
              >
                <div className="py-1 space-y-0.5" style={{ paddingInlineStart: '12px' }}>
                  {group.items.map(item => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                        isActive(item.path)
                          ? 'bg-teal-500/10 text-teal-500'
                          : `${textMuted} ${hoverBg} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`
                      }`}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User Card ── */}
      <div className={`p-4 border-t shrink-0 ${border}`}>
        <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white font-bold">{userInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${text}`}>{userName}</p>
            <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{displayPlan}</p>
          </div>
          <button
            onClick={onLogout}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-200 text-gray-500'
            }`}
            title={t('sidebar.logout')}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}