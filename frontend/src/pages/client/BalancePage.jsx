import { useState, useEffect, useRef } from "react";
import { 
  Plus, Wallet, TrendingDown, RefreshCw, Clock,
  CreditCard, AlertCircle, Loader2, Phone, DollarSign,
  Check, Shield, Lock, ArrowRight, X, Sparkles
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { userAPI, callsAPI } from "@/services/api/sondosAPI";
import { paymentAPI } from "@/services/api/paymentAPI";

// ── Dark mode CSS for Moyasar form ──
const MOYASAR_DARK_CSS = `
  .topup-mysr-form label, .topup-mysr-form .mysr-label { color: #d1d5db !important; }
  .topup-mysr-form input, .topup-mysr-form select, .topup-mysr-form .mysr-input {
    background-color: #0a0a0b !important; border: 1px solid #2a2a2d !important;
    color: #ffffff !important; border-radius: 10px !important; padding: 12px 14px !important;
  }
  .topup-mysr-form input::placeholder { color: #6b7280 !important; }
  .topup-mysr-form input:focus { border-color: #14b8a6 !important; box-shadow: 0 0 0 2px rgba(20,184,166,0.25) !important; }
  .topup-mysr-form .mysr-methods .mysr-method { background-color: #111113 !important; border-color: #1f1f23 !important; color: #d1d5db !important; }
  .topup-mysr-form .mysr-methods .mysr-method.active { background-color: #0a0a0b !important; border-color: #14b8a6 !important; color: #fff !important; }
  .topup-mysr-form button[type="submit"], .topup-mysr-form .mysr-btn-submit, .topup-mysr-form .mysr-btn {
    background: linear-gradient(to left, #14b8a6, #06b6d4) !important; color: #fff !important;
    border: none !important; border-radius: 12px !important; padding: 14px !important; font-weight: 700 !important;
  }
  .topup-mysr-form .mysr-error { color: #f87171 !important; }
  .topup-mysr-form { direction: ltr; text-align: left; }
`;
const MOYASAR_LIGHT_CSS = `
  .topup-mysr-form input { border-radius: 10px !important; padding: 12px 14px !important; }
  .topup-mysr-form button[type="submit"], .topup-mysr-form .mysr-btn-submit, .topup-mysr-form .mysr-btn {
    background: linear-gradient(to left, #14b8a6, #06b6d4) !important; color: #fff !important;
    border: none !important; border-radius: 12px !important; padding: 14px !important; font-weight: 700 !important;
  }
  .topup-mysr-form { direction: ltr; text-align: left; }
`;

// Preset topup amounts
const TOPUP_AMOUNTS = [50, 100, 200, 500];
const MIN_CUSTOM_AMOUNT = 10;

export default function BalancePage({ embedded = false }) {
  const { isDark } = useTheme();
  const { t, isAr } = useLanguage();
  
  // Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);
  
  // Topup State
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [topupStep, setTopupStep] = useState('select'); // select → form → processing → result
  const [topupError, setTopupError] = useState(null);
  const [topupCreating, setTopupCreating] = useState(false);
  const [topupResult, setTopupResult] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const moyasarInitialized = useRef(false);

  useEffect(() => { loadData(); }, []);

  // Inject Moyasar dark/light CSS for topup modal
  useEffect(() => {
    let styleEl = document.getElementById('moyasar-topup-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'moyasar-topup-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = isDark ? MOYASAR_DARK_CSS : MOYASAR_LIGHT_CSS;
  }, [isDark]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const userResponse = await userAPI.me();
      setUserData(userResponse);
      try {
        const callsResponse = await callsAPI.getAll({ per_page: 10 });
        if (callsResponse?.data && Array.isArray(callsResponse.data)) {
          setRecentCalls(callsResponse.data);
        }
      } catch (callsError) {
        console.log('Could not fetch calls:', callsError);
      }
    } catch (err) {
      console.error('Error loading balance:', err);
      setError(err.message || t('bal.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Topup Logic ──
  const getSelectedAmount = () => {
    if (topupAmount) return topupAmount;
    const parsed = parseFloat(customAmount);
    return !isNaN(parsed) && parsed >= MIN_CUSTOM_AMOUNT ? parsed : null;
  };

  const handleStartTopup = () => {
    setShowTopup(true);
    setTopupStep('select');
    setTopupAmount(null);
    setCustomAmount('');
    setTopupError(null);
    setTopupResult(null);
    setPaymentData(null);
    moyasarInitialized.current = false;
  };

  const handleConfirmTopup = async () => {
    const amount = getSelectedAmount();
    if (!amount) {
      setTopupError(isAr ? `أقل مبلغ ${MIN_CUSTOM_AMOUNT} ر.س` : `Minimum ${MIN_CUSTOM_AMOUNT} SAR`);
      return;
    }

    setTopupCreating(true);
    setTopupError(null);
    try {
      const res = await paymentAPI.createPayment({
        type: 'topup',
        amount: amount,
      });
      setPaymentData(res);
      setTopupStep('form');
      setTimeout(() => initMoyasarForm(res.moyasar), 200);
    } catch (err) {
      setTopupError(err.message || t('pay.createError'));
    } finally {
      setTopupCreating(false);
    }
  };

  const initMoyasarForm = (cfg) => {
    if (moyasarInitialized.current || !cfg) return;

    if (!window.Moyasar) {
      const script = document.createElement('script');
      script.src = 'https://cdn.moyasar.com/mpf/1.14.0/moyasar.js';
      script.onload = () => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.moyasar.com/mpf/1.14.0/moyasar.css';
        document.head.appendChild(link);
        createForm(cfg);
      };
      document.head.appendChild(script);
    } else {
      createForm(cfg);
    }
  };

  const createForm = (cfg) => {
    if (!cfg || moyasarInitialized.current) return;
    const container = document.querySelector('.topup-mysr-form');
    if (container) container.innerHTML = '';

    try {
      window.Moyasar.init({
        element: '.topup-mysr-form',
        amount: cfg.amount,
        currency: cfg.currency,
        description: cfg.description,
        publishable_api_key: cfg.publishableKey,
        callback_url: cfg.callbackUrl,
        supported_networks: ['visa', 'mastercard', 'mada'],
        methods: ['creditcard', 'stcpay'],
        metadata: cfg.metadata,
        on_initiating: function () {
          setTopupStep('processing');
          return true;
        },
        on_completed: function (payment) {
          // verify بشكل منفصل — لا تبلك الـ callback
          setTimeout(function() {
            paymentAPI.verifyPayment(
              cfg.metadata.payment_id,
              payment.id
            ).then(function(verifyRes) {
              if (verifyRes.status === 'paid') {
                // ✅ نتحقق من حالة التحويل الفعلية
                if (verifyRes.transferStatus === 'failed') {
                  setTopupResult({ success: false, message: verifyRes.message || (isAr ? 'تم الدفع لكن فشل تحويل الرصيد. تواصل مع الدعم.' : 'Payment received but balance transfer failed. Contact support.') });
                } else {
                  setTopupResult({ success: true });
                }
                setTopupStep('result');
                setTimeout(function() { loadData(); }, 1000);
              } else {
                setTopupResult({ success: false, message: verifyRes.message || (isAr ? 'حالة غير متوقعة' : 'Unexpected status') });
                setTopupStep('result');
              }
            }).catch(function(e) {
              console.error('Verify failed:', e);
              // ✅ لو التحقق فشل — نعرض فشل بدل نجاح كاذب
              setTopupResult({ success: false, message: isAr ? 'فشل التحقق من الدفع. لو تم الخصم من حسابك، تواصل مع الدعم.' : 'Payment verification failed. If charged, contact support.' });
              setTopupStep('result');
            });
          }, 100);
          return true;
        },
        on_failure: function (error) {
          setTopupResult({ success: false, message: error?.message || t('pay.failed') });
          setTopupStep('result');
          return true;
        },
      });
      moyasarInitialized.current = true;
    } catch (e) {
      console.error('Moyasar init error:', e);
      setTopupError(t('pay.formError'));
    }
  };

  const closeTopup = () => {
    setShowTopup(false);
    setTopupStep('select');
    moyasarInitialized.current = false;
    // Refresh if payment was made
    if (topupResult?.success) loadData();
  };

  // ── Calculations ──
  const totalSpent = Array.isArray(recentCalls)
    ? recentCalls.reduce((sum, call) => sum + (parseFloat(call?.total_cost) || 0), 0)
    : 0;
  const balance = parseFloat(userData?.total_balance ?? userData?.balance ?? userData?.credits ?? 0);
  const currency = userData?.currency || 'SAR';
  const formatNumber = (num, decimals = 2) => {
    const n = parseFloat(num);
    return isNaN(n) ? '0.00' : n.toFixed(decimals);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="space-y-8">
        {!embedded && (
          <div className="flex justify-between items-center">
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('bal.title')}</h1>
          </div>
        )}
        <div className={`flex flex-col items-center justify-center p-8 rounded-2xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className={`w-12 h-12 mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <p className={`text-lg font-medium mb-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
          <button onClick={handleRefresh}
            className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> {t('bal.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      {!embedded && (
        <div className="flex justify-between items-center">
          <div>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('bal.title')}</h1>
            <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bal.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleRefresh} disabled={refreshing}
              className={`p-3 rounded-xl transition-colors ${isDark ? 'bg-[#1a1a1d] hover:bg-[#222225] border border-[#1f1f23]' : 'bg-gray-100 hover:bg-gray-200 border border-gray-200'}`}
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''} ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
            </button>
            <button onClick={handleStartTopup}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-teal-500/25"
            >
              <Plus className="w-5 h-5" /> {t('bal.recharge')}
            </button>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Balance */}
        <div className={`rounded-2xl p-6 ${isDark ? 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30' : 'bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
              <Wallet className={`w-6 h-6 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${isDark ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'}`}>
              {t('bal.currentBalance')}
            </span>
          </div>
          <p className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatNumber(balance)}
            <span className={`text-lg mr-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {currency === 'SAR' ? t('bal.sar') : currency}
            </span>
          </p>
          <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bal.lastUpdate')}</p>
        </div>

        {/* Total Spent */}
        <div className={`rounded-2xl p-6 ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <TrendingDown className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
              {t('bal.consumption')}
            </span>
          </div>
          <p className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatNumber(totalSpent, 3)}
            <span className={`text-lg mr-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {currency === 'SAR' ? t('bal.sar') : currency}
            </span>
          </p>
          <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('bal.lastCalls').replace('{count}', recentCalls.length)}
          </p>
        </div>

        {/* Calls Count */}
        <div className={`rounded-2xl p-6 ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <Phone className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
              {t('bal.calls')}
            </span>
          </div>
          <p className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {recentCalls.length}
            <span className={`text-lg mr-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bal.call')}</span>
          </p>
          <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bal.recentCalls')}</p>
        </div>
      </div>

      {/* User Info */}
      {userData && (
        <div className={`rounded-2xl p-6 ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <CreditCard className="w-5 h-5 text-teal-500" /> {t('bal.accountInfo')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoItem label={t('bal.name')} value={userData.name || '-'} isDark={isDark} />
            <InfoItem label={t('bal.email')} value={userData.email || '-'} isDark={isDark} />
            <InfoItem label={t('bal.totalBalance')} value={`${formatNumber(balance)} ${currency === 'SAR' ? t('bal.sar') : currency}`} isDark={isDark} />
          </div>
        </div>
      )}

      {/* Recent Calls */}
      <div className={`rounded-2xl p-6 ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <Clock className="w-5 h-5 text-cyan-500" /> {t('bal.recentCalls')}
        </h3>
        {recentCalls.length > 0 ? (
          <div className="space-y-3">
            {recentCalls.slice(0, 5).map((call, index) => (
              <div key={call.id || index} className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${call.type === 'inbound' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100') : (isDark ? 'bg-purple-500/20' : 'bg-purple-100')}`}>
                    <Phone className={`w-4 h-4 ${call.type === 'inbound' ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-purple-400' : 'text-purple-600')}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{call.client_phone_number || t('bal.callLabel')}</p>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {call.created_at ? new Date(call.created_at).toLocaleString(isAr ? 'ar-SA' : 'en-US') : '-'}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className={`font-bold ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                    -{formatNumber(call.total_cost || 0, 3)} {currency === 'SAR' ? t('bal.sar') : currency}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')} ${t('bal.minute')}` : '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('bal.noRecentCalls')}</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button onClick={handleStartTopup}
          className={`flex items-center justify-between p-6 rounded-2xl transition-all hover:scale-[1.02] text-right ${isDark ? 'bg-gradient-to-l from-teal-500/20 to-cyan-500/20 border border-teal-500/30 hover:border-teal-500/50' : 'bg-gradient-to-l from-teal-50 to-cyan-50 border border-teal-200 hover:border-teal-300'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-xl ${isDark ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
              <CreditCard className={`w-8 h-8 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('bal.recharge')}</h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bal.addBalance')}</p>
            </div>
          </div>
        </button>

        <a href="/payment/history"
          className={`flex items-center justify-between p-6 rounded-2xl transition-all hover:scale-[1.02] ${isDark ? 'bg-[#111113] border border-[#1f1f23] hover:border-[#2a2a2d]' : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <Clock className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('bal.transactionHistory')}</h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('bal.viewAllTransactions')}</p>
            </div>
          </div>
        </a>
      </div>

      {/* ═══════════════════════════════════════════
          TOPUP MODAL
      ═══════════════════════════════════════════ */}
      {showTopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closeTopup(); }}>
          <div className={`w-full max-w-md rounded-2xl overflow-hidden ${isDark ? 'bg-[#111113] border border-[#1f1f23]' : 'bg-white border border-gray-200 shadow-2xl'}`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-[#1f1f23]' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
                  <Wallet className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                </div>
                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {topupStep === 'select' ? t('bal.recharge') : topupStep === 'form' ? (isAr ? 'بيانات الدفع' : 'Payment') : topupStep === 'processing' ? (isAr ? 'جاري المعالجة' : 'Processing') : (isAr ? 'النتيجة' : 'Result')}
                </h2>
              </div>
              <button onClick={closeTopup} className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-[#1a1a1d] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* ── Select Amount ── */}
              {topupStep === 'select' && (
                <div className="space-y-6">
                  {/* Preset amounts */}
                  <div>
                    <p className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {isAr ? 'اختر المبلغ' : 'Select amount'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {TOPUP_AMOUNTS.map((amount) => (
                        <button key={amount} onClick={() => { setTopupAmount(amount); setCustomAmount(''); }}
                          className={`p-4 rounded-xl border-2 text-center font-bold transition-all ${
                            topupAmount === amount
                              ? 'border-teal-500 bg-teal-500/10 text-teal-500'
                              : isDark ? 'border-[#1f1f23] bg-[#0a0a0b] text-white hover:border-[#2a2a2d]' : 'border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-2xl">{amount}</span>
                          <span className={`text-sm block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {isAr ? 'ر.س' : 'SAR'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom amount */}
                  <div>
                    <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {isAr ? 'أو أدخل مبلغ مخصص' : 'Or enter custom amount'}
                    </p>
                    <div className="relative">
                      <DollarSign className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                      <input type="number" min={MIN_CUSTOM_AMOUNT} placeholder={`${isAr ? 'أقل مبلغ' : 'Min'} ${MIN_CUSTOM_AMOUNT} ${isAr ? 'ر.س' : 'SAR'}`}
                        value={customAmount}
                        onChange={(e) => { setCustomAmount(e.target.value); setTopupAmount(null); }}
                        className={`w-full pr-12 pl-4 py-3.5 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 ${isDark ? 'bg-[#0a0a0b] border-[#1f1f23] text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {topupError && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                      <AlertCircle className="w-4 h-4" /><span className="text-sm">{topupError}</span>
                    </div>
                  )}

                  {/* Confirm */}
                  <button onClick={handleConfirmTopup} disabled={!getSelectedAmount() || topupCreating}
                    className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                      getSelectedAmount()
                        ? 'bg-gradient-to-l from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white shadow-lg shadow-teal-500/25'
                        : isDark ? 'bg-[#1a1a1d] text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {topupCreating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {isAr ? 'متابعة للدفع' : 'Continue to Payment'}
                        {getSelectedAmount() && (
                          <span className="opacity-80">— {getSelectedAmount()} {isAr ? 'ر.س' : 'SAR'}</span>
                        )}
                        <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ── Payment Form ── */}
              {topupStep === 'form' && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className={`flex justify-between items-center p-4 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{isAr ? 'شحن رصيد' : 'Top-up'}</span>
                    <span className="text-xl font-black text-teal-500">
                      {paymentData?.payment?.amountDisplay} {isAr ? 'ر.س' : 'SAR'}
                    </span>
                  </div>

                  {/* Moyasar form */}
                  <div className="topup-mysr-form"></div>

                  {/* Security */}
                  <div className={`flex items-center justify-center gap-2 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Shield className="w-4 h-4" /><span>{isAr ? 'دفع آمن ومشفر' : 'Secure payment'}</span>
                    <Lock className="w-4 h-4" /><span>PCI DSS</span>
                  </div>
                </div>
              )}

              {/* ── Processing ── */}
              {topupStep === 'processing' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className={`w-12 h-12 animate-spin mb-4 ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
                  <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {isAr ? 'جاري معالجة الدفع...' : 'Processing payment...'}
                  </p>
                  <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {isAr ? 'يرجى عدم إغلاق الصفحة' : 'Please do not close this page'}
                  </p>
                </div>
              )}

              {/* ── Result ── */}
              {topupStep === 'result' && (
                <div className="text-center space-y-4 py-4">
                  {topupResult?.success ? (
                    <>
                      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${isDark ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
                        <Check className={`w-8 h-8 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                      </div>
                      <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {isAr ? 'تم شحن الرصيد بنجاح!' : 'Top-up Successful!'}
                      </h3>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        {isAr ? 'تم إضافة الرصيد إلى حسابك' : 'Balance has been added to your account'}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                        <AlertCircle className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                      </div>
                      <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {isAr ? 'فشل الدفع' : 'Payment Failed'}
                      </h3>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        {topupResult?.message || (isAr ? 'لم تتم العملية' : 'Transaction failed')}
                      </p>
                    </>
                  )}
                  <button onClick={closeTopup}
                    className={`w-full py-3 rounded-xl font-bold transition-all ${
                      topupResult?.success
                        ? 'bg-gradient-to-l from-teal-500 to-cyan-500 text-white'
                        : isDark ? 'bg-white/10 text-white' : 'bg-gray-900 text-white'
                    }`}
                  >
                    {topupResult?.success ? (isAr ? 'تم' : 'Done') : (isAr ? 'حاول مرة أخرى' : 'Try Again')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, isDark }) {
  return (
    <div className={`p-4 rounded-xl ${isDark ? 'bg-[#0a0a0b]' : 'bg-gray-50'}`}>
      <p className={`text-sm mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}