import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ── Arabic namespaces ──
import arCommon from './ar/common.json';
import arAuth from './ar/auth.json';
import arDashboard from './ar/dashboard.json';
import arAgents from './ar/agents.json';
import arTools from './ar/tools.json';
import arKnowledge from './ar/knowledge.json';
import arLeads from './ar/leads.json';
import arChat from './ar/chat.json';
import arCalls from './ar/calls.json';
import arCampaigns from './ar/campaigns.json';
import arAnalytics from './ar/analytics.json';
import arPhones from './ar/phones.json';
import arBilling from './ar/billing.json';
import arSettings from './ar/settings.json';
import arAdmin from './ar/admin.json';
import arNotifications from './ar/notifications.json';
import arIntegrations from './ar/integrations.json';
import arErrors from './ar/errors.json';
import arValidation from './ar/validation.json';

// ── English namespaces ──
import enCommon from './en/common.json';
import enAuth from './en/auth.json';
import enDashboard from './en/dashboard.json';
import enAgents from './en/agents.json';
import enTools from './en/tools.json';
import enKnowledge from './en/knowledge.json';
import enLeads from './en/leads.json';
import enChat from './en/chat.json';
import enCalls from './en/calls.json';
import enCampaigns from './en/campaigns.json';
import enAnalytics from './en/analytics.json';
import enPhones from './en/phones.json';
import enBilling from './en/billing.json';
import enSettings from './en/settings.json';
import enAdmin from './en/admin.json';
import enNotifications from './en/notifications.json';
import enIntegrations from './en/integrations.json';
import enErrors from './en/errors.json';
import enValidation from './en/validation.json';

// ── Build flat resources for backward compatibility ──
// Merges all namespaces into a single object so t('sidebar.overview') still works
function flatMerge(...objects) {
  const result = {};
  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object') {
        result[key] = { ...result[key], ...value };
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

const arFlat = flatMerge(
  arCommon, { auth: arAuth }, { dashboard: arDashboard }, { agents: arAgents },
  { tools: arTools }, { knowledge: arKnowledge }, { leads: arLeads }, { chat: arChat },
  { calls: arCalls }, { campaigns: arCampaigns }, { analytics: arAnalytics },
  { phones: arPhones }, { billing: arBilling }, { settings: arSettings },
  { admin: arAdmin }, { notifications: arNotifications }, { integrations: arIntegrations },
  { errors: arErrors }, { validation: arValidation }
);

const enFlat = flatMerge(
  enCommon, { auth: enAuth }, { dashboard: enDashboard }, { agents: enAgents },
  { tools: enTools }, { knowledge: enKnowledge }, { leads: enLeads }, { chat: enChat },
  { calls: enCalls }, { campaigns: enCampaigns }, { analytics: enAnalytics },
  { phones: enPhones }, { billing: enBilling }, { settings: enSettings },
  { admin: enAdmin }, { notifications: enNotifications }, { integrations: enIntegrations },
  { errors: enErrors }, { validation: enValidation }
);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: arFlat },
      en: { translation: enFlat },
    },
    fallbackLng: 'ar',
    defaultNS: 'translation',
    keySeparator: '.',
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
      // Support old {n} format alongside new {{n}} format
      prefix: '{{',
      suffix: '}}',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'language',
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
