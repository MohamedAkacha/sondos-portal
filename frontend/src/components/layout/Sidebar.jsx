import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, BarChart3, Users, Phone,
  BookOpen, Link2, Settings, LogOut, Zap, Bot, CreditCard
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';

export default function Sidebar({ onLogout, user }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/',            icon: Home,     label: t('sidebar.overview')     },
    { path: '/dashboard',   icon: BarChart3, label: t('sidebar.dashboard')  },
    { path: '/calls',       icon: Phone,    label: 'المكالمات'               },
    { path: '/leads',       icon: Users,    label: t('sidebar.leads')        },
    { path: '/knowledge',   icon: BookOpen, label: t('sidebar.knowledge')    },
    { path: '/assistant',   icon: Bot,      label: t('sidebar.assistant')    },
    { path: '/integrations',icon: Link2,    label: t('sidebar.integrations') },
    { path: '/payment',     icon: CreditCard,label: t('sidebar.payment')    },
    { path: '/settings',    icon: Settings, label: t('sidebar.settings')     },
  ];

  const userName    = user?.name || user?.companyName || user?.email?.split('@')[0] || t('sidebar.defaultUser');
  const userPlan    = user?.plan || user?.subscription?.plan || 'basic';
  const userInitial = userName.charAt(0).toUpperCase();

  const planNames = {
    'free':         t('sidebar.planFree'),
    'basic':        t('sidebar.planBasic'),
    'starter':      t('sidebar.planBasic'),
    'professional': t('sidebar.planPro'),
    'pro':          t('sidebar.planPro'),
    'enterprise':   t('sidebar.planEnterprise'),
    'business':     t('sidebar.planBusiness'),
  };
  const displayPlan = planNames[userPlan?.toLowerCase()] || userPlan;

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <aside className={`w-72 h-screen sticky top-0 border-l flex flex-col transition-colors duration-300 ${
      isDark ? 'bg-[#111113] border-[#1f1f23]' : 'bg-white border-gray-200'
    }`}>
      {/* Logo */}
      <div className={`p-6 border-b transition-colors shrink-0 ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Sondos AI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive(item.path)
                ? 'bg-teal-500/10 text-teal-500 border border-teal-500/20'
                : isDark
                ? 'text-gray-400 hover:bg-[#1a1a1d] hover:text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Card */}
      <div className={`p-4 border-t transition-colors shrink-0 ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
        <div className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white font-bold">{userInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{userName}</p>
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