import React, { useState, useEffect, useRef } from 'react';
import { MapPin, CheckCircle2, AlertCircle, Loader2, ChevronDown, History, RefreshCw, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, fetchStores, logGeotag } from './stores';

interface GeotagRecord {
  storeId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function App() {
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionLogs, setSessionLogs] = useState<GeotagRecord[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  // Searchable dropdown state
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter stores based on search query
  const filteredStores = stores.filter(store => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      store.name.toLowerCase().includes(q) ||
      store.city.toLowerCase().includes(q) ||
      store.id.toLowerCase().includes(q)
    );
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch stores from Google Sheet on mount
  const loadStores = async () => {
    setIsLoadingStores(true);
    setLoadError(null);
    try {
      const data = await fetchStores();
      setStores(data);
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load stores.');
    } finally {
      setIsLoadingStores(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  const handleLogGeotagging = () => {
    if (!selectedStoreId) {
      setError('Please select a store first.');
      return;
    }

    const store = stores.find(s => s.id === selectedStoreId);
    if (store?.hasGeotag) {
      setError('This store has already been geotagged.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLocating(true);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude, accuracy });
        setIsLocating(false);
        setIsSaving(true);

        try {
          const result = await logGeotag({
            storeId: selectedStoreId,
            latitude,
            longitude,
            accuracy,
          });

          if (result.success) {
            // Mark the store as geotagged locally
            setStores(prev =>
              prev.map(s =>
                s.id === selectedStoreId ? { ...s, hasGeotag: true } : s
              )
            );

            setSessionLogs(prev => [
              {
                storeId: selectedStoreId,
                timestamp: Date.now(),
                latitude,
                longitude,
                accuracy,
              },
              ...prev,
            ]);

            setSuccess(
              `Successfully logged geotag for ${store?.name}`
            );
          } else {
            setError(result.error || 'Failed to save geotag to Google Sheet.');
          }
        } catch (e: any) {
          setError(`Failed to save: ${e.message}`);
        } finally {
          setIsSaving(false);
        }
      },
      (err) => {
        console.error(err);
        setError(`Failed to get location: ${err.message}. Please ensure location permissions are granted.`);
        setIsLocating(false);
      },
      options
    );
  };

  const selectedStore = stores.find(s => s.id === selectedStoreId);
  const hasSubmitted = selectedStore?.hasGeotag ?? false;
  const isWorking = isLocating || isSaving;

  // ─── Loading State ───────────────────────────────────────────────────────────
  if (isLoadingStores) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-white mx-auto">
            <Loader2 size={24} className="animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium">Loading stores...</p>
            <p className="text-xs opacity-40 mt-1">Fetching from Google Sheet</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[24px] p-8 shadow-sm border border-black/5 max-w-md w-full text-center space-y-4"
        >
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
            <AlertCircle size={24} />
          </div>
          <div>
            <h2 className="text-lg font-medium mb-1">Connection Error</h2>
            <p className="text-sm text-red-600 leading-relaxed">{loadError}</p>
          </div>
          <button
            onClick={loadStores}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/90 active:scale-[0.98] transition-all"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-black selection:text-white">
      <div className="max-w-md mx-auto px-6 py-12 md:py-24">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
              <MapPin size={20} />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest opacity-50">Precision Utility</span>
          </div>
          <h1 className="text-4xl font-light tracking-tight mb-2">Geotagging</h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Select a store location to log high-accuracy coordinates. Data is saved directly to Google Sheets.
          </p>
        </header>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[24px] p-8 shadow-sm border border-black/5 mb-8"
        >
          <div className="space-y-6">
            {/* Store Selection — Searchable */}
            <div>
              <label className="block text-[11px] uppercase tracking-widest font-semibold opacity-40 mb-3">
                Select Store
              </label>
              <div className="relative" ref={dropdownRef}>
                {/* Search Input */}
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    value={isDropdownOpen ? searchQuery : (selectedStore ? `${selectedStore.name} — ${selectedStore.city}` : searchQuery)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!isDropdownOpen) setIsDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setIsDropdownOpen(true);
                      if (selectedStoreId) setSearchQuery('');
                    }}
                    placeholder="Search by name, city, or ID..."
                    className="w-full bg-[#f9f9f9] border border-black/5 rounded-xl pl-10 pr-10 py-4 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all text-sm"
                  />
                  {/* Clear / Chevron button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedStoreId || searchQuery) {
                        setSelectedStoreId('');
                        setSearchQuery('');
                        setError(null);
                        setSuccess(null);
                        setCurrentLocation(null);
                      }
                      setIsDropdownOpen(!isDropdownOpen);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-60 transition-opacity p-1"
                  >
                    {selectedStoreId || searchQuery ? <X size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* Dropdown List */}
                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 mt-2 w-full bg-white rounded-xl border border-black/5 shadow-lg max-h-60 overflow-y-auto"
                    >
                      {filteredStores.length === 0 ? (
                        <div className="p-4 text-center text-xs opacity-40">
                          No stores match "{searchQuery}"
                        </div>
                      ) : (
                        filteredStores.map((store) => (
                          <button
                            key={store.id}
                            type="button"
                            onClick={() => {
                              setSelectedStoreId(store.id);
                              setSearchQuery('');
                              setIsDropdownOpen(false);
                              setError(null);
                              setSuccess(null);
                              setCurrentLocation(null);
                            }}
                            className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-[#f5f5f5] transition-colors border-b border-black/[0.03] last:border-b-0 ${
                              store.id === selectedStoreId ? 'bg-[#f5f5f5]' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {store.name}
                              </p>
                              <p className="text-[10px] opacity-40 truncate">
                                {store.id} • {store.city}
                              </p>
                            </div>
                            <div className="shrink-0 ml-2">
                              {store.hasGeotag ? (
                                <span className="text-emerald-500">
                                  <CheckCircle2 size={14} />
                                </span>
                              ) : store.id === selectedStoreId ? (
                                <span className="w-2 h-2 rounded-full bg-black inline-block" />
                              ) : null}
                            </div>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Selected Store Info */}
            <AnimatePresence mode="wait">
              {selectedStore && (
                <motion.div
                  key={selectedStore.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#f9f9f9] rounded-xl p-4 space-y-1 overflow-hidden"
                >
                  <p className="text-[10px] uppercase tracking-widest font-semibold opacity-30">Store Details</p>
                  <p className="text-sm font-medium">{selectedStore.name}</p>
                  <p className="text-xs opacity-50">{selectedStore.city} • {selectedStore.region}</p>
                  {selectedStore.hasGeotag && (
                    <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 pt-1">
                      <CheckCircle2 size={10} /> Already geotagged
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Messages */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-3 p-4 bg-red-50 text-red-600 rounded-xl text-sm"
                >
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm"
                >
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">{success}</p>
                    {currentLocation && (
                      <p className="text-xs opacity-80 font-mono">
                        {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)} (±{currentLocation.accuracy.toFixed(1)}m)
                      </p>
                    )}
                    <p className="text-[10px] opacity-50 mt-1">✓ Saved to Google Sheet</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Button */}
            <button
              onClick={handleLogGeotagging}
              disabled={isWorking || hasSubmitted || !selectedStoreId}
              className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                hasSubmitted
                  ? 'bg-emerald-500 text-white cursor-default'
                  : isWorking
                    ? 'bg-black/5 text-black/40 cursor-wait'
                    : !selectedStoreId
                      ? 'bg-black/5 text-black/20 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-black/90 active:scale-[0.98]'
              }`}
            >
              {isLocating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Pinpointing Location...</span>
                </>
              ) : isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Saving to Sheet...</span>
                </>
              ) : hasSubmitted ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>Logged Successfully</span>
                </>
              ) : (
                <span>Log Geotagging</span>
              )}
            </button>
          </div>
        </motion.div>

        {/* Session Activity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[11px] uppercase tracking-widest font-semibold opacity-40 flex items-center gap-2">
              <History size={12} />
              Session Logs
            </h2>
            <span className="text-[11px] font-mono opacity-30">
              {stores.filter(s => s.hasGeotag).length} / {stores.length} tagged
            </span>
          </div>

          <div className="space-y-2">
            {sessionLogs.length === 0 ? (
              <div className="bg-white/50 border border-dashed border-black/10 rounded-2xl p-8 text-center">
                <p className="text-xs opacity-30">No geotags logged this session.</p>
              </div>
            ) : (
              sessionLogs.map((log) => {
                const store = stores.find((s) => s.id === log.storeId);
                return (
                  <motion.div
                    key={log.storeId + '-' + log.timestamp}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-2xl p-4 border border-black/5 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{store?.name}</p>
                      <p className="text-[10px] font-mono opacity-40">
                        {new Date(log.timestamp).toLocaleTimeString()} • {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <CheckCircle2 size={14} />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-black/5 text-center">
          <p className="text-[10px] font-mono opacity-20 uppercase tracking-widest">
            High Accuracy GPS • Google Sheets Sync • v2.0.0
          </p>
        </footer>
      </div>
    </div>
  );
}
