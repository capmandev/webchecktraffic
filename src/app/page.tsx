'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  Trash2,
  Search,
  Loader2,
  X,
  RefreshCw,
  Settings,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Key,
  Copy,
  Download,
  FileSpreadsheet,
  Zap,
  ExternalLink,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Share2,
} from 'lucide-react';
import { TrafficCheckRecord, DomainCheckResult } from '@/lib/types';
import { copyDomainsToClipboard, copyTableToClipboard, exportToExcel } from '@/lib/export';

interface KeyCreditStatus {
  key: string;
  valid: boolean;
  isExhausted: boolean;
  usable: number;
  freeRemaining: number;
  error?: string;
}

export default function Home() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Settings Modal state - Support up to 10 shared team keys
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<string[]>(Array(10).fill(''));
  const [endpointInput, setEndpointInput] = useState('https://scrappa.co/api/similarweb');
  const [forceRefresh, setForceRefresh] = useState(false);
  const [showKeys, setShowKeys] = useState<boolean[]>(Array(10).fill(false));
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);
  const [saveSettingsError, setSaveSettingsError] = useState<string | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isInlineGuideExpanded, setIsInlineGuideExpanded] = useState(false);

  // Credit balance states
  const [keyCredits, setKeyCredits] = useState<Record<string, KeyCreditStatus>>({});
  const [totalCredits, setTotalCredits] = useState<number | null>(null);
  const [isCheckingCredits, setIsCheckingCredits] = useState(false);

  // Copy feedback state
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Input state
  const [inputText, setInputText] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgressText, setCheckProgressText] = useState<string | null>(null);

  // Current results state
  const [currentResults, setCurrentResults] = useState<DomainCheckResult[]>([]);
  const [currentSummary, setCurrentSummary] = useState<{
    total: number;
    cached: number;
    fresh: number;
    errors: number;
  } | null>(null);

  // History state
  const [history, setHistory] = useState<TrafficCheckRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Filters
  const [minTrafficInput, setMinTrafficInput] = useState<string>('');
  const [maxTrafficInput, setMaxTrafficInput] = useState<string>('');
  const [starredFilter, setStarredFilter] = useState<'all' | 'starred'>('all');
  const [domainSearch, setDomainSearch] = useState<string>('');

  // Bulk selection
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());

  // Delete Modals
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load team keys from Supabase (shared across all users)
  const loadSharedTeamKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const res = await fetch('/api/keys', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.keys)) {
        const fullKeys = Array(10).fill('');
        data.keys.forEach((k: string, idx: number) => {
          if (idx < 10 && typeof k === 'string') {
            fullKeys[idx] = k.trim();
          }
        });
        setApiKeys(fullKeys);
        if (data.endpoint) {
          setEndpointInput(data.endpoint);
        }
        localStorage.setItem('scrappa_api_keys', JSON.stringify(fullKeys));

        const active = fullKeys.filter((k) => k.length > 0);
        if (active.length > 0) {
          fetchCredits(active);
        }
        return;
      }
    } catch (err) {
      console.warn('Cannot fetch /api/keys, fallback to localStorage', err);
    } finally {
      setIsLoadingKeys(false);
    }

    // Fallback to local storage if API call fails
    let loadedKeys = Array(10).fill('');
    const savedKeysRaw = localStorage.getItem('scrappa_api_keys');
    if (savedKeysRaw) {
      try {
        const parsed = JSON.parse(savedKeysRaw);
        if (Array.isArray(parsed)) {
          loadedKeys = [...parsed, ...Array(10).fill('')].slice(0, 10);
        }
      } catch {
        const legacyKey = localStorage.getItem('scarpa_api_key') || '';
        loadedKeys[0] = legacyKey;
      }
    } else {
      const legacyKey = localStorage.getItem('scarpa_api_key') || '';
      if (legacyKey) {
        loadedKeys[0] = legacyKey;
      }
    }
    setApiKeys(loadedKeys);

    const savedEndpoint = localStorage.getItem('scarpa_api_endpoint');
    if (savedEndpoint) {
      setEndpointInput(savedEndpoint);
    }

    const validKeys = loadedKeys.filter((k) => k.trim().length > 0);
    if (validKeys.length > 0) {
      fetchCredits(validKeys);
    }
  };

  // Check auth & load saved settings on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('traffic_checker_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }

    const savedEndpoint = localStorage.getItem('scarpa_api_endpoint');
    if (savedEndpoint) {
      setEndpointInput(savedEndpoint);
    }

    // Load team keys from Supabase
    loadSharedTeamKeys();
  }, []);

  // Fetch history when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated]);

  // Check credits for keys (real-time free quota check)
  const fetchCredits = async (keysToCheck?: string[]) => {
    const candidateKeys = (keysToCheck || apiKeys).map((k) => k.trim()).filter(Boolean);
    if (candidateKeys.length === 0) {
      setTotalCredits(null);
      setKeyCredits({});
      return;
    }

    setIsCheckingCredits(true);
    try {
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeys: candidateKeys,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        const map: Record<string, KeyCreditStatus> = {};
        data.results.forEach((item: any) => {
          map[item.key] = {
            key: item.key,
            valid: Boolean(item.valid),
            isExhausted: Boolean(item.isExhausted || item.usable <= 0),
            usable: Number(item.usable || 0),
            freeRemaining: Number(item.freeRemaining || 0),
            error: item.error,
          };
        });
        setKeyCredits(map);
        setTotalCredits(data.totalCredits);
      }
    } catch (err) {
      console.error('Lỗi kiểm tra credits:', err);
    } finally {
      setIsCheckingCredits(false);
    }
  };

  // Auth Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('traffic_checker_auth', 'true');
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || 'Mật khẩu không đúng');
      }
    } catch (err) {
      setAuthError('Không thể kết nối đến máy chủ');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('traffic_checker_auth');
    setIsAuthenticated(false);
    setPasswordInput('');
  };

  // Update specific key slot
  const handleKeyChange = (index: number, val: string) => {
    setApiKeys((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const toggleShowKey = (index: number) => {
    setShowKeys((prev) => {
      const copy = [...prev];
      copy[index] = !copy[index];
      return copy;
    });
  };

  // Save Settings directly to Supabase for the entire team
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSaveSettingsError(null);
    const cleanedKeys = apiKeys.map((k) => k.trim());

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keys: cleanedKeys,
          endpoint: endpointInput.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('scrappa_api_keys', JSON.stringify(cleanedKeys));
        localStorage.setItem('scarpa_api_key', cleanedKeys[0] || '');
        localStorage.setItem('scarpa_api_endpoint', endpointInput.trim());

        setSettingsSavedToast(true);
        const active = cleanedKeys.filter((k) => k.length > 0);
        if (active.length > 0) {
          fetchCredits(active);
        }

        setTimeout(() => {
          setSettingsSavedToast(false);
          setIsSettingsOpen(false);
        }, 1000);
      } else {
        setSaveSettingsError(data.error || 'Lỗi khi lưu keys vào database');
      }
    } catch (err) {
      setSaveSettingsError('Không thể kết nối đến máy chủ để lưu keys');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const activeKeyCount = apiKeys.filter((k) => k.trim().length > 0).length;

  const exhaustedKeysCount = useMemo(() => {
    let count = 0;
    for (const key of apiKeys) {
      const trimmed = key.trim();
      if (trimmed && keyCredits[trimmed]) {
        const status = keyCredits[trimmed];
        if (!status.valid || status.isExhausted || status.usable <= 0) {
          count++;
        }
      }
    }
    return count;
  }, [apiKeys, keyCredits]);

  // Fetch history from DB
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        setHistory(data.records);
      } else {
        setHistoryError(data.error || 'Lỗi tải dữ liệu');
      }
    } catch (err) {
      setHistoryError('Không thể kết nối cơ sở dữ liệu');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Check Traffic
  const handleCheckTraffic = async () => {
    const raw = inputText.trim();
    if (!raw) return;

    const validKeys = apiKeys.map((k) => k.trim()).filter(Boolean);
    if (validKeys.length === 0) {
      alert('Chưa có Scrappa API Key! Vui lòng vào "⚙️ Cấu hình API" để nhập key dùng chung cho cả team.');
      setIsSettingsOpen(true);
      return;
    }

    if (totalCredits !== null && totalCredits <= 0) {
      alert('Tất cả API keys hiện tại đều đã hết lượt (0 credits)! Vui lòng vào "⚙️ Cấu hình API" để thay key mới từ scrappa.co.');
      setIsSettingsOpen(true);
      return;
    }

    setIsChecking(true);
    setCurrentResults([]);
    setCurrentSummary(null);

    const lineCount = raw.split(/[\r\n,;]+/).filter((l) => l.trim()).length;
    setCheckProgressText(`Đang kiểm tra ${lineCount} domain từ Similarweb...`);

    const payload = {
      domains: raw,
      apiKeys: validKeys,
      endpoint: endpointInput.trim() || 'https://scrappa.co/api/similarweb',
      forceRefresh,
    };

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setCurrentResults(data.results);
        setCurrentSummary(data.summary);
        fetchHistory();
        // Refresh credit balances after check
        fetchCredits(validKeys);
      } else {
        alert(data.error || 'Lỗi trong quá trình kiểm tra traffic');
      }
    } catch (err) {
      alert('Không thể kết nối đến máy chủ');
    } finally {
      setIsChecking(false);
      setCheckProgressText(null);
    }
  };

  // Toggle Star
  const handleToggleStar = async (domain: string, currentStarred: boolean) => {
    const newStarred = !currentStarred;
    setHistory((prev) =>
      prev.map((item) => (item.domain === domain ? { ...item, is_starred: newStarred } : item))
    );
    setCurrentResults((prev) =>
      prev.map((item) => (item.domain === domain ? { ...item, is_starred: newStarred } : item))
    );

    try {
      await fetch('/api/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, is_starred: newStarred }),
      });
    } catch (err) {
      fetchHistory();
    }
  };

  // Delete Single
  const executeDeleteSingle = async () => {
    if (!domainToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: [domainToDelete] }),
      });
      const data = await res.json();
      if (data.success) {
        setHistory((prev) => prev.filter((d) => d.domain !== domainToDelete));
        setSelectedDomains((prev) => {
          const next = new Set(prev);
          next.delete(domainToDelete);
          return next;
        });
      }
    } finally {
      setIsDeleting(false);
      setDomainToDelete(null);
    }
  };

  // Delete Bulk
  const executeBulkDelete = async () => {
    const domainsArray = Array.from(selectedDomains);
    if (domainsArray.length === 0) return;
    setIsDeleting(true);

    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: domainsArray }),
      });
      const data = await res.json();
      if (data.success) {
        const deletedSet = new Set(domainsArray);
        setHistory((prev) => prev.filter((d) => !deletedSet.has(d.domain)));
        setSelectedDomains(new Set());
      }
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  // Filter history
  const filteredHistory = useMemo(() => {
    const minVal = minTrafficInput.trim() !== '' ? Number(minTrafficInput.replace(/,/g, '')) : null;
    const maxVal = maxTrafficInput.trim() !== '' ? Number(maxTrafficInput.replace(/,/g, '')) : null;
    const searchVal = domainSearch.trim().toLowerCase();

    return history.filter((item) => {
      if (minVal !== null && !isNaN(minVal) && item.monthly_traffic < minVal) return false;
      if (maxVal !== null && !isNaN(maxVal) && item.monthly_traffic > maxVal) return false;
      if (starredFilter === 'starred' && !item.is_starred) return false;
      if (searchVal && !item.domain.toLowerCase().includes(searchVal)) return false;
      return true;
    });
  }, [history, minTrafficInput, maxTrafficInput, starredFilter, domainSearch]);

  const isAllFilteredSelected =
    filteredHistory.length > 0 &&
    filteredHistory.every((item) => selectedDomains.has(item.domain));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedDomains((prev) => {
        const next = new Set(prev);
        filteredHistory.forEach((item) => next.delete(item.domain));
        return next;
      });
    } else {
      setSelectedDomains((prev) => {
        const next = new Set(prev);
        filteredHistory.forEach((item) => next.add(item.domain));
        return next;
      });
    }
  };

  const handleToggleSelectRow = (domain: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const formatTraffic = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return val.toLocaleString('en-US');
  };

  // Clipboard & Excel Handlers
  const handleCopyDomains = async (domains: string[]) => {
    const success = await copyDomainsToClipboard(domains);
    if (success) {
      setCopyFeedback(`Đã copy ${domains.length} domain!`);
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const handleCopyTable = async (rows: { domain: string; monthly_traffic: number | null | undefined }[]) => {
    const success = await copyTableToClipboard(rows);
    if (success) {
      setCopyFeedback('Đã copy bảng số thuần (dán vào Excel chuẩn)!');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const handleExportExcel = (rows: TrafficCheckRecord[] | DomainCheckResult[], filename = 'traffic_data.xlsx') => {
    exportToExcel(rows, filename);
  };

  // Initial loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  // =========================================================================
  // AUTH SCREEN (MẬT KHẨ NỘI BỘ)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-sm">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">TRAFFIC CHECKER</h1>
            <p className="text-xs text-slate-500">Trang nội bộ — Vui lòng nhập mật khẩu</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Mật khẩu truy cập..."
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
              />
              {authError && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {authError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isAuthenticating || !passwordInput.trim()}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang mở khóa...</span>
                </>
              ) : (
                <span>Vào hệ thống</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN DASHBOARD (TINH GỌN)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      {/* Toast alert */}
      {copyFeedback && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyFeedback}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-5">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm tracking-wider shadow-sm">
              TC
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">TRAFFIC CHECKER</h1>
              <span className="text-[11px] text-slate-500 font-medium">SimilarWeb API &bull; 30d Cache</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Credits Badge */}
            {activeKeyCount > 0 && (
              <button
                type="button"
                onClick={() => fetchCredits()}
                disabled={isCheckingCredits}
                title="Bấm để kiểm tra lại số dư credits (không tốn phí)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors shadow-2xs"
              >
                <Zap className={`w-3.5 h-3.5 fill-current text-emerald-600 ${isCheckingCredits ? 'animate-spin' : ''}`} />
                <span>
                  {isCheckingCredits
                    ? 'Đang check...'
                    : totalCredits !== null
                    ? `${totalCredits.toLocaleString('en-US')} Credits`
                    : 'Check credits'}
                </span>
              </button>
            )}

            {/* Warning badge if any key is exhausted */}
            {exhaustedKeysCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(true);
                  fetchCredits();
                }}
                title={`${exhaustedKeysCount} key đã hết lượt credits (0 credits). Bấm để thay key mới ngay!`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold hover:bg-rose-200 transition-colors animate-pulse shadow-2xs"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>{exhaustedKeysCount} key hết lượt</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Hướng dẫn lấy Key</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(true);
                fetchCredits();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Cấu hình API</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  exhaustedKeysCount > 0
                    ? 'bg-amber-500'
                    : activeKeyCount > 0
                    ? 'bg-emerald-500'
                    : 'bg-rose-500'
                }`}
                title={
                  exhaustedKeysCount > 0
                    ? `Có ${exhaustedKeysCount} key hết lượt`
                    : activeKeyCount > 0
                    ? `${activeKeyCount} API Key sẵn sàng`
                    : 'Chưa cấu hình API key'
                }
              />
              <span className="text-[10px] text-slate-500 font-mono">({activeKeyCount}/10 key)</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="Khóa trang"
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Neat inline collapsible guide banner */}
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-white to-blue-50/40 p-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsInlineGuideExpanded((prev) => !prev)}
              className="flex items-center gap-2 text-left group"
            >
              <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs group-hover:bg-blue-700 transition-colors">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  Hướng dẫn nhanh: Đăng ký & Lấy Scrappa API Key (3 bước)
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  50 credits free/key
                </span>
              </div>
              {isInlineGuideExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              )}
            </button>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const url = `${window.location.origin}/guide`;
                    navigator.clipboard.writeText(url);
                    setCopyFeedback('Đã copy link hướng dẫn (/guide)');
                    setTimeout(() => setCopyFeedback(null), 2500);
                  }
                }}
                title="Copy đường link trang hướng dẫn đầy đủ để gửi cho đồng đội"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition-colors shadow-2xs"
              >
                <Share2 className="w-3 h-3 text-blue-600" />
                <span>Chia sẻ link</span>
              </button>

              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors shadow-2xs"
              >
                <span>Xem chi tiết</span>
              </button>
            </div>
          </div>

          {/* Expanded inline content */}
          {isInlineGuideExpanded && (
            <div className="mt-3 pt-3 border-t border-blue-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in fade-in duration-200">
              <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                    Đăng ký tài khoản
                  </span>
                  <a
                    href="https://scrappa.co/register"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Mở link</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Vào <strong>scrappa.co/register</strong> điền tên, email và mật khẩu. Nhận ngay <strong>50 credits free/tháng</strong> không cần thẻ tín dụng.
                </p>
                <img
                  src="/images/guide-step1-register.jpg"
                  alt="Đăng ký"
                  className="rounded border border-slate-200 w-full h-24 object-cover mt-1"
                />
              </div>

              <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                  Lấy API Key
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Ở menu bên trái, vào mục <strong>API Keys</strong>. Tại thẻ <strong>Your API Key</strong>, bấm nút <strong>Copy Key</strong>.
                </p>
                <img
                  src="/images/guide-step2-copy-key.jpg"
                  alt="Copy Key"
                  className="rounded border border-slate-200 w-full h-24 object-cover mt-1"
                />
              </div>

              <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                  Dán vào app & Lưu
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Bấm nút <strong>⚙️ Cấu hình API</strong> trên web, dán key vào slot trống hoặc ô báo đỏ, rồi bấm <strong>Lưu cấu hình (Đồng bộ cả Team)</strong>.
                </p>
                <img
                  src="/images/guide-step3-paste-app.jpg"
                  alt="Dán Key"
                  className="rounded border border-slate-200 w-full h-24 object-cover mt-1"
                />
              </div>
            </div>
          )}
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
          <textarea
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhập 1 hoặc dán hàng loạt domain/URL (ví dụ: example.com, https://test.com/abc...)"
            className="w-full rounded-lg border border-slate-300 p-3 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            disabled={isChecking}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                disabled={isChecking}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="font-medium text-slate-700">Quét lại từ đầu (Bỏ qua cache 30 ngày)</span>
            </label>

            <div className="flex items-center gap-2">
              {inputText.trim() && (
                <button
                  type="button"
                  onClick={() => setInputText('')}
                  disabled={isChecking}
                  className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Xóa
                </button>
              )}
              <button
                type="button"
                onClick={handleCheckTraffic}
                disabled={isChecking || !inputText.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs tracking-wider uppercase shadow-xs transition-all"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : (
                  <span>CHECK TRAFFIC</span>
                )}
              </button>
            </div>
          </div>

          {isChecking && checkProgressText && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2 text-blue-800 text-xs font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>{checkProgressText}</span>
            </div>
          )}
        </div>

        {/* Current Results */}
        {currentResults.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                  KẾT QUẢ VỪA QUÉT ({currentResults.length})
                </h2>
                {currentSummary && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                    {currentSummary.cached > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Cache: {currentSummary.cached}
                      </span>
                    )}
                    {currentSummary.fresh > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        API: {currentSummary.fresh}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons: Copy & Export */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleCopyDomains(currentResults.map((r) => r.domain))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                  title="Copy danh sách domain (1 domain/dòng)"
                >
                  <Copy className="w-3 h-3 text-slate-500" />
                  <span>Copy domain</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyTable(currentResults)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                  title="Copy bảng số nguyên thuần túy (paste trực tiếp vào Excel/Sheets)"
                >
                  <FileSpreadsheet className="w-3 h-3 text-slate-500" />
                  <span>Copy bảng</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportExcel(currentResults, `traffic_check_${Date.now()}.xlsx`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  title="Tải file Excel .xlsx"
                >
                  <Download className="w-3 h-3" />
                  <span>Xuất Excel</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center">⭐</th>
                    <th className="py-2.5 px-3">DOMAIN</th>
                    <th className="py-2.5 px-4 text-right">MONTHLY TRAFFIC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentResults.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center">
                        {row.status !== 'error' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleStar(row.domain, row.is_starred)}
                            className="text-amber-400 hover:text-amber-500"
                          >
                            {row.is_starred ? (
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            ) : (
                              <Star className="w-3.5 h-3.5 text-slate-300 hover:text-amber-400" />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://${row.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-blue-600 hover:underline group"
                            title={`Mở https://${row.domain} trong tab mới`}
                          >
                            <span>{row.domain}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 opacity-60 group-hover:opacity-100" />
                          </a>
                          {row.status === 'cached' && (
                            <span className="text-[10px] text-emerald-600 font-sans font-semibold">
                              (cache &lt;30d)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">
                        {row.status === 'error' ? (
                          <span className="text-red-600 font-sans font-medium">
                            {row.error || 'Lỗi'}
                          </span>
                        ) : (
                          formatTraffic(row.monthly_traffic)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* History Area */}
        <div className="space-y-2.5 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                KẾT QUẢ ĐÃ QUÉT ({history.length})
              </h2>
              <button
                type="button"
                onClick={fetchHistory}
                disabled={isLoadingHistory}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>
            </div>

            {/* History Action buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleCopyDomains(filteredHistory.map((r) => r.domain))}
                disabled={filteredHistory.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium"
                title="Copy tất cả domain đang lọc"
              >
                <Copy className="w-3 h-3 text-slate-500" />
                <span>Copy domain ({filteredHistory.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyTable(filteredHistory)}
                disabled={filteredHistory.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium"
                title="Copy bảng số nguyên thuần túy"
              >
                <FileSpreadsheet className="w-3 h-3 text-slate-500" />
                <span>Copy bảng</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportExcel(filteredHistory, `traffic_history_${Date.now()}.xlsx`)}
                disabled={filteredHistory.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-medium"
                title="Tải file Excel .xlsx"
              >
                <Download className="w-3 h-3" />
                <span>Xuất Excel</span>
              </button>
            </div>
          </div>

          {/* Streamlined Filter Bar */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 space-y-2.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <input
                  type="text"
                  placeholder="Min traffic (vd: 50,000)"
                  value={minTrafficInput}
                  onChange={(e) => setMinTrafficInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Max traffic (vd: 1,000,000)"
                  value={maxTrafficInput}
                  onChange={(e) => setMaxTrafficInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Starred Tab */}
              <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setStarredFilter('all')}
                  className={`flex-1 py-1 font-semibold rounded transition-all ${
                    starredFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  ALL
                </button>
                <button
                  type="button"
                  onClick={() => setStarredFilter('starred')}
                  className={`flex-1 py-1 font-semibold rounded inline-flex items-center justify-center gap-1 transition-all ${
                    starredFilter === 'starred'
                      ? 'bg-white text-amber-600 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>STARRED</span>
                </button>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm domain..."
                  value={domainSearch}
                  onChange={(e) => setDomainSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-8 pr-6 py-1.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {domainSearch && (
                  <button
                    onClick={() => setDomainSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {(minTrafficInput || maxTrafficInput || starredFilter !== 'all' || domainSearch) && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                <span>Hiển thị {filteredHistory.length} / {history.length} domain</span>
                <button
                  type="button"
                  onClick={() => {
                    setMinTrafficInput('');
                    setMaxTrafficInput('');
                    setStarredFilter('all');
                    setDomainSearch('');
                  }}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between px-1 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isAllFilteredSelected}
                onChange={handleToggleSelectAll}
                disabled={filteredHistory.length === 0}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>Chọn tất cả ({filteredHistory.length})</span>
            </label>

            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={selectedDomains.size === 0 || isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed border border-red-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa đã chọn {selectedDomains.size > 0 ? `(${selectedDomains.size})` : ''}</span>
            </button>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {history.length === 0 ? 'Chưa có domain nào được quét.' : 'Không có domain phù hợp.'}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <th className="py-2.5 px-3 w-8 text-center"></th>
                    <th className="py-2.5 px-3 w-8 text-center">⭐</th>
                    <th className="py-2.5 px-3">DOMAIN</th>
                    <th className="py-2.5 px-4 text-right">MONTHLY TRAFFIC</th>
                    <th className="py-2.5 px-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((row) => {
                    const isSelected = selectedDomains.has(row.domain);
                    return (
                      <tr
                        key={row.domain}
                        className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(row.domain)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStar(row.domain, row.is_starred)}
                            className="text-amber-400 hover:text-amber-500"
                          >
                            {row.is_starred ? (
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            ) : (
                              <Star className="w-3.5 h-3.5 text-slate-300 hover:text-amber-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-slate-900">
                          <a
                            href={`https://${row.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-blue-600 hover:underline group"
                            title={`Mở https://${row.domain} trong tab mới`}
                          >
                            <span>{row.domain}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 opacity-60 group-hover:opacity-100" />
                          </a>
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">
                          {formatTraffic(row.monthly_traffic)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setDomainToDelete(row.domain)}
                            title="Xóa"
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL CẤU HÌNH API 10 KEYS DÙNG CHUNG CẢ TEAM VÀ HIỂN THỊ CREDITS TỰ ĐỘNG */}
        {/* ========================================================================= */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cấu hình 10 Scrappa API Keys (Dùng chung cả Team)</h3>
                    <p className="text-[11px] text-slate-500">Ai cũng có thể điền & thay key. Dữ liệu tự động đồng bộ qua Supabase.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGuideOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold border border-blue-200 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>Xem hướng dẫn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Total credits and status banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">Tổng credits khả dụng cả team:</span>
                    <span className="text-lg font-black text-emerald-600">
                      {totalCredits !== null ? `${totalCredits.toLocaleString('en-US')} Credits` : '—'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {activeKeyCount > 0
                        ? `${activeKeyCount - exhaustedKeysCount}/${activeKeyCount} key khả dụng (${activeKeyCount}/10 slot)`
                        : 'Chưa có key nào'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchCredits()}
                    disabled={isCheckingCredits}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingCredits ? 'animate-spin text-blue-600' : ''}`} />
                    <span>Check số dư</span>
                  </button>
                </div>

                {/* Key exhaustion warning banner */}
                {exhaustedKeysCount > 0 && (
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Phát hiện {exhaustedKeysCount} key đã hết lượt (0 credits)!</strong> Vui lòng dán key mới vào các ô đỏ bên dưới để tiếp tục kiểm tra traffic.
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-xs">
                {/* 10 API Keys slots */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Danh sách 10 API Keys (Free Tier Scrappa)</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-normal">
                        Tối đa 10 key
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">Tự động xoay sang key kế tiếp khi hết lượt</span>
                  </div>

                  <div className="space-y-2">
                    {apiKeys.map((keyVal, idx) => {
                      const trimmed = keyVal.trim();
                      const status = trimmed ? keyCredits[trimmed] : null;
                      const isDead = status && (!status.valid || status.isExhausted || status.usable <= 0);

                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-xl border transition-all ${
                            isDead
                              ? 'border-rose-300 bg-rose-50/40'
                              : trimmed && status?.valid && status.usable > 0
                              ? 'border-emerald-200 bg-emerald-50/20'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-14 text-[11px] font-mono font-semibold ${isDead ? 'text-rose-700' : 'text-slate-600'}`}>
                              Key #{idx + 1}:
                            </span>
                            <div className="relative flex-1">
                              <input
                                type={showKeys[idx] ? 'text' : 'password'}
                                value={keyVal}
                                onChange={(e) => handleKeyChange(idx, e.target.value)}
                                placeholder={`Dán Scrappa API Key slot ${idx + 1}...`}
                                className={`w-full rounded-lg border pl-3 pr-16 py-1.5 font-mono text-xs text-slate-900 focus:outline-none transition-colors ${
                                  isDead
                                    ? 'border-rose-400 bg-white focus:ring-2 focus:ring-rose-400'
                                    : 'border-slate-300 bg-white focus:ring-1 focus:ring-blue-500'
                                }`}
                              />
                              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {trimmed && (
                                  <button
                                    type="button"
                                    onClick={() => handleKeyChange(idx, '')}
                                    title="Xóa key này để thay key mới"
                                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleShowKey(idx)}
                                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  {showKeys[idx] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Credits balance badge under key */}
                          <div className="pl-16 pt-1 text-[10px] flex items-center justify-between">
                            {trimmed ? (
                              status ? (
                                status.valid ? (
                                  status.usable > 0 ? (
                                    <span className="px-2 py-0.5 rounded font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 inline-flex items-center gap-1">
                                      ✓ Còn {status.usable.toLocaleString('en-US')} credits
                                      {status.freeRemaining > 0 && (
                                        <span className="font-normal text-emerald-600">({status.freeRemaining} free)</span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded font-extrabold text-rose-700 bg-rose-100 border border-rose-300 inline-flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3 text-rose-600" />
                                      ⚠ 0 credits (HẾT LƯỢT — CẦN THAY KEY MỚI)
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-0.5 rounded font-bold text-red-700 bg-red-100 border border-red-300 inline-flex items-center gap-1">
                                    ✕ {status.error || 'Key không hợp lệ hoặc đã bị thu hồi'}
                                  </span>
                                )
                              ) : isCheckingCredits ? (
                                <span className="text-slate-400 italic">Đang kiểm tra số dư...</span>
                              ) : (
                                <span className="text-slate-400">Chưa kiểm tra số dư</span>
                              )
                            ) : (
                              <span className="text-slate-400 italic">Slot trống — Chưa điền key</span>
                            )}

                            {isDead && (
                              <span className="text-rose-600 font-semibold text-[10px]">
                                Cần thay thế
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* API Endpoint */}
                <div className="pt-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    API Endpoint
                  </label>
                  <input
                    type="text"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    placeholder="https://scrappa.co/api/similarweb"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Mặc định: https://scrappa.co/api/similarweb
                  </span>
                </div>

                {/* Cam kết dữ liệu thật 100% */}
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-blue-950">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>Cam kết 100% số liệu thực từ Similarweb (Tuyệt đối không bịa số)</span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Hệ thống chỉ trả về số liệu thực lấy từ Scrappa Similarweb API. Mỗi tài khoản miễn phí tại <a href="https://scrappa.co" target="_blank" rel="noreferrer" className="font-bold underline hover:text-blue-950">scrappa.co</a> có 50 credits/tháng. Bất kỳ thành viên nào trong team đều có thể tạo tài khoản và điền key vào 10 ô trên để dùng chung cho cả nhóm.
                  </p>
                </div>
              </div>

              {settingsSavedToast && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-bounce">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Đã lưu 10 API keys dùng chung thành công! Đồng bộ cho cả team.</span>
                </div>
              )}

              {saveSettingsError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>{saveSettingsError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  disabled={isSavingSettings}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu lên Supabase...</span>
                    </>
                  ) : (
                    <span>Lưu cấu hình (Đồng bộ cả Team)</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL HƯỚNG DẪN ĐĂNG KÝ VÀ LẤY API KEY CÓ ẢNH MINH HỌA */}
        {/* ========================================================================= */}
        {isGuideOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-2xl w-full space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Hướng Dẫn Đăng Ký & Lấy Scrappa API Key</h3>
                    <p className="text-xs text-slate-500">Nhận 50 credits/tháng miễn phí cho mỗi tài khoản</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 text-xs text-slate-700">
                {/* Bước 1 */}
                <div className="space-y-2 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white font-bold text-xs">
                      Bước 1: Đăng ký tài khoản Scrappa miễn phí
                    </span>
                    <a
                      href="https://scrappa.co/register"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold hover:underline"
                    >
                      <span>Mở trang đăng ký scrappa.co</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Truy cập vào <strong>https://scrappa.co/register</strong>. Điền Họ tên, Email và Mật khẩu rồi bấm <strong>Sign Up Free (50 Credits)</strong>. Bạn sẽ nhận ngay 50 credits Similarweb miễn phí mỗi tháng mà không cần thẻ tín dụng.
                  </p>
                  <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm mt-2 bg-slate-900">
                    <img
                      src="/images/guide-step1-register.jpg"
                      alt="Minh họa đăng ký Scrappa"
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>

                {/* Bước 2 */}
                <div className="space-y-2 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white font-bold text-xs inline-block">
                    Bước 2: Lấy API Key từ Scrappa Dashboard
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Sau khi đăng nhập, ở thanh menu bên trái chọn mục <strong>API Keys</strong>. Tại ô <strong>Your API Key</strong>, bấm nút <strong>Copy Key</strong> để sao chép chuỗi mã khóa bí mật vào bộ nhớ tạm.
                  </p>
                  <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm mt-2 bg-slate-900">
                    <img
                      src="/images/guide-step2-copy-key.jpg"
                      alt="Minh họa copy API Key từ Scrappa"
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>

                {/* Bước 3 */}
                <div className="space-y-2 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white font-bold text-xs inline-block">
                    Bước 3: Dán Key vào app Webchecktraffic & Lưu cấu hình
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Quay lại ứng dụng Webchecktraffic, bấm nút <strong>⚙️ Cấu hình API</strong>. Chọn một slot trống (Key #1 đến #10) hoặc slot đang báo đỏ <em>(⚠ 0 credits)</em>, dán key vào và bấm <strong>Lưu cấu hình (Đồng bộ cả Team)</strong>. Key sẽ được đồng bộ ngay lập tức cho toàn bộ các thành viên khác trong team qua Supabase!
                  </p>
                  <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm mt-2 bg-slate-900">
                    <img
                      src="/images/guide-step3-paste-app.jpg"
                      alt="Minh họa dán Key vào Webchecktraffic"
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>

                {/* Mẹo cho Team */}
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Mẹo tối ưu dung lượng cho cả Team:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800">
                    <li>Mỗi tài khoản miễn phí tại Scrappa nhận 50 credits/tháng.</li>
                    <li>Với 10 slots key dùng chung, nhóm của bạn có tối đa <strong>500 lượt check Similarweb miễn phí</strong> mỗi tháng.</li>
                    <li>Hệ thống tự động xoay key khi 1 key hết lượt; khi một key về 0 credits, web sẽ hiện cảnh báo đỏ để các bạn biết và dán key mới vào thay thế.</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const url = `${window.location.origin}/guide`;
                        navigator.clipboard.writeText(url);
                        setCopyFeedback('Đã copy link hướng dẫn (/guide)');
                        setTimeout(() => setCopyFeedback(null), 2500);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
                  >
                    <Share2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Copy link chia sẻ cho Team</span>
                  </button>

                  <a
                    href="/guide"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-blue-600 hover:text-blue-800 hover:bg-blue-50 text-xs font-semibold transition-colors"
                  >
                    <span>Mở trang riêng</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGuideOpen(false)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  Đã hiểu, đóng lại
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Single Delete Modal */}
        {domainToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-5 max-w-xs w-full space-y-3 text-center">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-700">
                Bạn có chắc muốn xóa <span className="font-semibold text-slate-900">{domainToDelete}</span>?
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDomainToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={executeDeleteSingle}
                  disabled={isDeleting}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                >
                  {isDeleting ? '...' : 'Xóa'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Modal */}
        {isBulkDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-5 max-w-xs w-full space-y-3 text-center">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-700">
                Bạn có chắc muốn xóa <span className="font-bold text-red-600">{selectedDomains.size}</span> domain đã chọn?
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={executeBulkDelete}
                  disabled={isDeleting}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                >
                  {isDeleting ? '...' : 'Xóa'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
