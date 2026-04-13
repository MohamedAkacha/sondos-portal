import { useState, useEffect, useRef } from "react";
import { Mic, Play, Pause, Check, Loader2, AlertCircle, Search, Filter, ChevronDown, Volume2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
// v2: Direct fetch instead of sondosAPI
const assistantsAPI = {
  getVoices: async () => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch('/api/voices/elevenlabs', { headers: { Authorization: `Bearer ${token}` } });
    return res.json();
  }
};

export default function VoicesPage() {
  const { isDark } = useTheme();
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [playingVoice, setPlayingVoice] = useState(null);
  
  // Filters
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  
  const audioRef = useRef(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    loadVoices();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowLanguageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadVoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await assistantsAPI.getVoices();
      console.log('Voices response:', response);
      
      let voicesData = [];
      if (response.data && Array.isArray(response.data)) {
        voicesData = response.data;
      } else if (Array.isArray(response)) {
        voicesData = response;
      } else if (response.voices && Array.isArray(response.voices)) {
        voicesData = response.voices;
      } else if (typeof response === 'object') {
        // If response is an object with voice providers
        voicesData = Object.entries(response).flatMap(([provider, voices]) => {
          if (Array.isArray(voices)) {
            return voices.map(v => ({ ...v, provider }));
          }
          return [];
        });
      }
      
      setVoices(voicesData);
      
      // Extract unique languages
      const langs = [...new Set(voicesData.map(v => v.language || v.lang || v.locale || 'Unknown'))];
      setLanguages(langs);
      
    } catch (err) {
      console.error('Error loading voices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    setShowLanguageDropdown(false);
  };

  const playVoice = (voice) => {
    // Check if voice has a preview URL
    const previewUrl = voice.preview_url || voice.sample_url || voice.audio_url || voice.preview;
    
    if (previewUrl) {
      if (playingVoice === voice.id || playingVoice === voice.voice_id) {
        // Stop playing
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setPlayingVoice(null);
      } else {
        // Start playing
        if (audioRef.current) {
          audioRef.current.src = previewUrl;
          audioRef.current.play();
        }
        setPlayingVoice(voice.id || voice.voice_id);
      }
    } else {
      alert('No preview available for this voice');
    }
  };

  const handleAudioEnded = () => {
    setPlayingVoice(null);
  };

  const selectVoice = (voice) => {
    setSelectedVoice(voice.id || voice.voice_id);
  };

  // Filter voices
  const filteredVoices = voices.filter(voice => {
    const matchesSearch = !searchQuery || 
      (voice.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (voice.language || voice.lang || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLanguage = !selectedLanguage || 
      (voice.language || voice.lang || voice.locale) === selectedLanguage;
    
    return matchesSearch && matchesLanguage;
  });

  // Get voice display info
  const getVoiceName = (voice) => voice.name || voice.voice_name || voice.id || 'Unknown';
  const getVoiceLanguage = (voice) => voice.language || voice.lang || voice.locale || 'Unknown';
  const getVoiceGender = (voice) => voice.gender || voice.sex || null;
  const getVoiceProvider = (voice) => voice.provider || voice.source || null;

  return (
    <div className="space-y-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} onEnded={handleAudioEnded} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Voices</h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Browse and select voices from Sondos AI</p>
        </div>
        <div className={`px-4 py-2 rounded-xl ${isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
          {filteredVoices.length} voices
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Language Filter */}
        <div className="relative">
          <button 
            ref={buttonRef}
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)} 
            className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 min-w-[180px] justify-between ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white hover:bg-[#1a1a1d]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} ${selectedLanguage ? 'ring-2 ring-teal-500/50' : ''}`}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-teal-500" />
              <span className="truncate">{selectedLanguage || 'All Languages'}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showLanguageDropdown && (
            <div 
              ref={dropdownRef}
              className={`absolute top-full left-0 mt-2 w-56 max-h-80 overflow-y-auto rounded-xl border shadow-2xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200'}`}
              style={{ zIndex: 9999 }}
            >
              <div 
                onClick={() => handleLanguageChange(null)} 
                className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-teal-500/10 ${!selectedLanguage ? 'bg-teal-500/10 text-teal-500' : isDark ? 'text-white' : 'text-gray-900'}`}
              >
                <span>All Languages</span>
                {!selectedLanguage && <span className="text-teal-500">✓</span>}
              </div>
              <div className={`border-t ${isDark ? 'border-[#27272a]' : 'border-gray-200'}`} />
              {languages.map(lang => (
                <div 
                  key={lang} 
                  onClick={() => handleLanguageChange(lang)} 
                  className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-teal-500/10 ${selectedLanguage === lang ? 'bg-teal-500/10 text-teal-500' : isDark ? 'text-white' : 'text-gray-900'}`}
                >
                  <span>{lang}</span>
                  {selectedLanguage === lang && <span className="text-teal-500">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input 
            type="text" 
            placeholder="Search voices..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className={`w-full pl-4 pr-11 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} 
          />
        </div>

        {/* Refresh */}
        <button 
          onClick={loadVoices} 
          disabled={loading} 
          className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 ${isDark ? 'bg-[#111113] border-[#1f1f23] text-white hover:bg-[#1a1a1d]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
        >
          <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</span>
        </div>
      )}

      {/* Voices Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-teal-500' : 'text-teal-600'}`} />
        </div>
      ) : filteredVoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Mic className={`w-16 h-16 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
          <p className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No voices found</p>
          {selectedLanguage && (
            <button onClick={() => handleLanguageChange(null)} className="mt-2 text-teal-500 hover:underline">
              Show all languages
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVoices.map((voice, index) => {
            const voiceId = voice.id || voice.voice_id || index;
            const isSelected = selectedVoice === voiceId;
            const isPlaying = playingVoice === voiceId;
            
            return (
              <div 
                key={voiceId} 
                className={`rounded-xl p-5 border transition-all cursor-pointer ${
                  isDark 
                    ? `bg-[#111113] border-[#1f1f23] hover:border-teal-500/50 ${isSelected ? 'ring-2 ring-teal-500' : ''}` 
                    : `bg-white border-gray-200 hover:border-teal-500/50 ${isSelected ? 'ring-2 ring-teal-500' : ''}`
                }`}
                onClick={() => selectVoice(voice)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      getVoiceGender(voice) === 'female' || getVoiceGender(voice) === 'Female'
                        ? 'bg-pink-500/10 text-pink-500'
                        : getVoiceGender(voice) === 'male' || getVoiceGender(voice) === 'Male'
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-teal-500/10 text-teal-500'
                    }`}>
                      <Mic className="w-6 h-6" />
                    </div>
                    <div>
                      <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {getVoiceName(voice)}
                      </p>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {getVoiceLanguage(voice)}
                      </p>
                      {getVoiceProvider(voice) && (
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {getVoiceProvider(voice)}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                {/* Gender & Accent badges */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {getVoiceGender(voice) && (
                    <span className={`px-2 py-1 rounded-lg text-xs ${
                      isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getVoiceGender(voice)}
                    </span>
                  )}
                  {voice.accent && (
                    <span className={`px-2 py-1 rounded-lg text-xs ${
                      isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {voice.accent}
                    </span>
                  )}
                  {voice.age && (
                    <span className={`px-2 py-1 rounded-lg text-xs ${
                      isDark ? 'bg-[#1a1a1d] text-gray-400' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {voice.age}
                    </span>
                  )}
                </div>

                {/* Play button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); playVoice(voice); }}
                  className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                    isPlaying 
                      ? 'bg-teal-500 text-white' 
                      : isDark 
                        ? 'bg-[#1a1a1d] text-white hover:bg-[#222225]' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" />
                      Playing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Preview
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}