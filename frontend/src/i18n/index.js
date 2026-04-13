import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ── Legacy translations (old page keys: login.*, asst.*, over.*, dash.*, etc.) ──
import arLegacy from './ar/_legacy.json';
import enLegacy from './en/_legacy.json';

// ── New namespace files ──
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

// ── Deep merge utility ──
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
        result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ── Build AR: legacy first (base), then new namespaces on top ──
const arFlat = deepMerge(
  // Legacy keys (login.*, asst.*, over.*, dash.*, sett.*, bal.*, pay.*, kb.*, integ.*, lead.*, etc.)
  arLegacy,
  // New namespace keys
  {
    ...arCommon,
    auth: arAuth,
    dashboard: arDashboard,
    agents: arAgents,
    tools: arTools,
    knowledge: arKnowledge,
    leads: arLeads,
    chat: arChat,
    calls: arCalls,
    campaigns: arCampaigns,
    analytics: arAnalytics,
    phones: arPhones,
    billing: arBilling,
    settings: arSettings,
    admin: arAdmin,
    notifications: arNotifications,
    integrations: arIntegrations,
    errors: arErrors,
    validation: arValidation,
  }
);

// ── Build EN: same approach ──
const enFlat = deepMerge(
  enLegacy,
  {
    ...enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    agents: enAgents,
    tools: enTools,
    knowledge: enKnowledge,
    leads: enLeads,
    chat: enChat,
    calls: enCalls,
    campaigns: enCampaigns,
    analytics: enAnalytics,
    phones: enPhones,
    billing: enBilling,
    settings: enSettings,
    admin: enAdmin,
    notifications: enNotifications,
    integrations: enIntegrations,
    errors: enErrors,
    validation: enValidation,
  }
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