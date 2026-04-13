/**
 * Sondos AI Chat Widget — Embeddable on any website
 * 
 * Usage:
 * <script src="https://cdn.sondos.ai/widget/v1/sondos-chat.min.js"></script>
 * <script>
 *   SondosChat.init({
 *     agentId: "AGENT_ID",
 *     apiUrl: "https://api.sondos.ai",
 *     language: "ar",
 *     position: "bottom-right",
 *     primaryColor: "#6366f1",
 *     greeting: "أهلاً! كيف أقدر أساعدك؟",
 *   });
 * </script>
 */
(function() {
  'use strict';

  const DEFAULT_CONFIG = {
    agentId: '',
    apiUrl: '',
    language: 'ar',
    position: 'bottom-right',
    primaryColor: '#6366f1',
    greeting: '',
    placeholder: '',
    title: 'سندس AI',
  };

  let config = {};
  let sessionId = null;
  let isOpen = false;
  let container = null;

  // ── Translations ──
  const i18n = {
    ar: { placeholder: 'اكتب رسالتك...', send: 'إرسال', powered: 'مدعوم من سندس AI', close: 'إغلاق', connecting: 'جاري الاتصال...' },
    en: { placeholder: 'Type your message...', send: 'Send', powered: 'Powered by Sondos AI', close: 'Close', connecting: 'Connecting...' },
  };

  function t(key) { return (i18n[config.language] || i18n.ar)[key] || key; }

  // ── API ──
  async function apiCall(path, body) {
    const res = await fetch(`${config.apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function startSession() {
    const data = await apiCall(`/api/chat/public/${config.agentId}/start`, {
      visitorPageUrl: window.location.href,
      visitorUserAgent: navigator.userAgent,
    });
    if (data.success) {
      sessionId = data.data.sessionId;
      if (data.data.greeting) addMessage('assistant', data.data.greeting);
    }
  }

  async function sendMessage(text) {
    if (!sessionId) return;
    addMessage('user', text);
    setTyping(true);

    try {
      const data = await apiCall(`/api/chat/public/${sessionId}/message`, { message: text });
      setTyping(false);
      if (data.success && data.data.reply) {
        addMessage('assistant', data.data.reply);
      }
    } catch (err) {
      setTyping(false);
      addMessage('system', 'حدث خطأ. حاول مرة أخرى.');
    }
  }

  // ── UI ──
  function addMessage(role, content) {
    const msgs = container.querySelector('.sondos-messages');
    const div = document.createElement('div');
    div.className = `sondos-msg sondos-msg-${role}`;
    div.textContent = content;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function setTyping(show) {
    const typing = container.querySelector('.sondos-typing');
    if (typing) typing.style.display = show ? 'block' : 'none';
  }

  function createWidget() {
    const isRTL = config.language === 'ar';
    const pos = config.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;';
    const dir = isRTL ? 'rtl' : 'ltr';

    container = document.createElement('div');
    container.id = 'sondos-chat-widget';
    container.innerHTML = `
      <style>
        #sondos-chat-widget * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .sondos-bubble { position: fixed; bottom: 20px; ${pos} width: 60px; height: 60px; border-radius: 50%; background: ${config.primaryColor}; color: white; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 24px; z-index: 99998; transition: transform 0.2s; }
        .sondos-bubble:hover { transform: scale(1.1); }
        .sondos-window { position: fixed; bottom: 90px; ${pos} width: 380px; height: 520px; background: #1a1a2e; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); display: none; flex-direction: column; overflow: hidden; z-index: 99999; direction: ${dir}; }
        .sondos-window.open { display: flex; }
        .sondos-header { background: ${config.primaryColor}; color: white; padding: 16px; display: flex; align-items: center; justify-content: space-between; }
        .sondos-header-title { font-weight: 600; font-size: 15px; }
        .sondos-close { background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 4px 8px; border-radius: 6px; }
        .sondos-close:hover { background: rgba(255,255,255,0.2); }
        .sondos-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .sondos-msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
        .sondos-msg-user { background: ${config.primaryColor}; color: white; align-self: ${isRTL ? 'flex-start' : 'flex-end'}; border-bottom-${isRTL ? 'left' : 'right'}-radius: 4px; }
        .sondos-msg-assistant { background: #2a2a4a; color: #e0e0e0; align-self: ${isRTL ? 'flex-end' : 'flex-start'}; border-bottom-${isRTL ? 'right' : 'left'}-radius: 4px; }
        .sondos-msg-system { background: #333; color: #999; align-self: center; font-size: 12px; }
        .sondos-typing { display: none; padding: 4px 16px; color: #888; font-size: 12px; }
        .sondos-input-area { padding: 12px; border-top: 1px solid #2a2a4a; display: flex; gap: 8px; }
        .sondos-input { flex: 1; background: #2a2a4a; border: 1px solid #3a3a5a; border-radius: 10px; padding: 10px 14px; color: white; font-size: 14px; outline: none; direction: ${dir}; }
        .sondos-input:focus { border-color: ${config.primaryColor}; }
        .sondos-send { background: ${config.primaryColor}; color: white; border: none; border-radius: 10px; padding: 10px 16px; cursor: pointer; font-size: 14px; }
        .sondos-send:hover { opacity: 0.9; }
        .sondos-send:disabled { opacity: 0.5; cursor: default; }
        .sondos-footer { text-align: center; padding: 6px; font-size: 11px; color: #555; }
        @media (max-width: 420px) { .sondos-window { width: calc(100vw - 20px); ${pos.includes('left') ? 'left: 10px;' : 'right: 10px;'} bottom: 80px; height: 70vh; } }
      </style>

      <button class="sondos-bubble" aria-label="Chat">💬</button>
      <div class="sondos-window">
        <div class="sondos-header">
          <span class="sondos-header-title">${config.title}</span>
          <button class="sondos-close" aria-label="${t('close')}">✕</button>
        </div>
        <div class="sondos-messages"></div>
        <div class="sondos-typing">${isRTL ? 'يكتب...' : 'Typing...'}</div>
        <div class="sondos-input-area">
          <input class="sondos-input" placeholder="${config.placeholder || t('placeholder')}" />
          <button class="sondos-send">${isRTL ? '↵' : '↵'}</button>
        </div>
        <div class="sondos-footer">${t('powered')}</div>
      </div>
    `;

    document.body.appendChild(container);

    // Events
    const bubble = container.querySelector('.sondos-bubble');
    const window_ = container.querySelector('.sondos-window');
    const closeBtn = container.querySelector('.sondos-close');
    const input = container.querySelector('.sondos-input');
    const sendBtn = container.querySelector('.sondos-send');

    bubble.addEventListener('click', () => {
      isOpen = !isOpen;
      window_.classList.toggle('open', isOpen);
      bubble.style.display = isOpen ? 'none' : 'flex';
      if (isOpen && !sessionId) startSession();
      if (isOpen) input.focus();
    });

    closeBtn.addEventListener('click', () => {
      isOpen = false;
      window_.classList.remove('open');
      bubble.style.display = 'flex';
    });

    const doSend = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendMessage(text);
    };

    sendBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
  }

  // ── Public API ──
  window.SondosChat = {
    init: function(userConfig) {
      config = { ...DEFAULT_CONFIG, ...userConfig };
      if (!config.agentId || !config.apiUrl) {
        console.error('SondosChat: agentId and apiUrl are required');
        return;
      }
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        createWidget();
      } else {
        document.addEventListener('DOMContentLoaded', createWidget);
      }
    },
    open: function() { container?.querySelector('.sondos-bubble')?.click(); },
    close: function() { container?.querySelector('.sondos-close')?.click(); },
  };
})();
