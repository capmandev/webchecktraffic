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
} from 'lucide-react';
import { TrafficCheckRecord, DomainCheckResult } from '@/lib/types';
import { copyDomainsToClipboard, copyTableToClipboard, exportToExcel } from '@/lib/export';

interface KeyCreditStatus {
  key: string;
  valid: boolean;
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

  // Settings Modal state - Support up to 5 keys
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<string[]>(['', '', '', '', '']);
  const [endpointInput, setEndpointInput] = useState('https://scrappa.co/api/similarweb');
  const [mockEnabled, setMockEnabled] = useState(true);
  const [showKeys, setShowKeys] = useState<boolean[]>([false, false, false, false, false]);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

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

  // Check auth & load saved settings on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('traffic_checker_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }

    // Load multi-keys settings
    let loadedKeys = ['', '', '', '', ''];
    const savedKeysRaw = localStorage.getItem('scrappa_api_keys');
    if (savedKeysRaw) {
      try {
        const parsed = JSON.parse(savedKeysRaw);
        if (Array.isArray(parsed)) {
          loadedKeys = [...parsed, '', '', '', '', ''].slice(0, 5);
        }
      } catch {
        const legacyKey = localStorage.getItem('scarpa_api_key') || '';
        loadedKeys = [legacyKey, '', '', '', ''];
      }
    } else {
      const legacyKey = localStorage.getItem('scarpa_api_key') || '';
      if (legacyKey) {
        loadedKeys = [legacyKey, '', '', '', ''];
      }
    }
    setApiKeys(loadedKeys);

    const savedEndpoint = localStorage.getItem('scarpa_api_endpoint');
    if (savedEndpoint) {
      setEndpointInput(savedEndpoint);
    }

    const savedMock = localStorage.getItem('scarpa_mock_enabled');
    if (savedMock !== null) {
      setMockEnabled(savedMock === 'true');
    }

    // Check credits for existing keys
    const validKeys = loadedKeys.filter((k) => k.trim().length > 0);
    if (validKeys.length > 0) {
      fetchCredits(validKeys);
    }
  }, []);

  // Fetch history when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated]);

  // Check credits for keys
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
          enableMock: mockEnabled,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        const map: Record<string, KeyCreditStatus> = {};
        data.results.forEach((item: any) => {
          map[item.key] = {
            key: item.key,
            valid: item.valid,
            usable: item.usable,
            freeRemaining: item.freeRemaining,
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

  // Save Settings
  const handleSaveSettings = () => {
    const cleanedKeys = apiKeys.map((k) => k.trim());
    localStorage.setItem('scrappa_api_keys', JSON.stringify(cleanedKeys));
    localStorage.setItem('scarpa_api_key', cleanedKeys[0] || '');
    localStorage.setItem('scarpa_api_endpoint', endpointInput.trim());
    localStorage.setItem('scarpa_mock_enabled', mockEnabled ? 'true' : 'false');

    setSettingsSavedToast(true);
    fetchCredits(cleanedKeys);

    setTimeout(() => {
      setSettingsSavedToast(false);
      setIsSettingsOpen(false);
    }, 600);
  };

  const activeKeyCount = apiKeys.filter((k) => k.trim().length > 0).length;

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

    setIsChecking(true);
    setCurrentResults([]);
    setCurrentSummary(null);

    const lineCount = raw.split(/[\r\n,;]+/).filter((l) => l.trim()).length;
    setCheckProgressText(`Đang kiểm tra ${lineCount} domain...`);

    const validKeys = apiKeys.map((k) => k.trim()).filter(Boolean);

    const payload = {
      domains: raw,
      apiKeys: validKeys,
      endpoint: endpointInput.trim() || 'https://scrappa.co/api/similarweb',
      enableMock: mockEnabled,
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
                    ? 'Đang kiểm tra...'
                    : totalCredits !== null
                    ? `${totalCredits.toLocaleString('en-US')} Credits`
                    : 'Check credits'}
                </span>
              </button>
            )}

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
                  activeKeyCount > 0 ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
                title={activeKeyCount > 0 ? `${activeKeyCount} API Key sẵn sàng` : 'Chưa có key (Mock mode)'}
              />
              {activeKeyCount > 0 && (
                <span className="text-[10px] text-slate-500 font-mono">({activeKeyCount} key)</span>
              )}
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

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Tự động loại bỏ trùng lặp &bull; Tự xoay 5 keys khi hết quota
            </span>

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
        {/* MODAL CẤU HÌNH API 5 KEYS VÀ HIỂN THỊ CREDITS TỰ ĐỘNG */}
        {/* ========================================================================= */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cấu hình Scrappa API (5 Keys)</h3>
                    <p className="text-[11px] text-slate-500">Tự động kiểm tra số dư credits không mất phí</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Total credits banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Tổng credits khả dụng:</span>
                  <span className="text-base font-extrabold text-emerald-600">
                    {totalCredits !== null ? `${totalCredits.toLocaleString('en-US')} Credits` : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchCredits()}
                  disabled={isCheckingCredits}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingCredits ? 'animate-spin' : ''}`} />
                  <span>Check số dư</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* 5 API Keys slots */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700">
                      Danh sách 5 API Keys (Free Tier)
                    </label>
                    <span className="text-[10px] text-slate-400">Tự xoay khi hết credits</span>
                  </div>

                  {apiKeys.map((keyVal, idx) => {
                    const trimmed = keyVal.trim();
                    const status = trimmed ? keyCredits[trimmed] : null;

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-[11px] font-mono text-slate-500">Key #{idx + 1}:</span>
                          <div className="relative flex-1">
                            <input
                              type={showKeys[idx] ? 'text' : 'password'}
                              value={keyVal}
                              onChange={(e) => handleKeyChange(idx, e.target.value)}
                              placeholder={`Dán Scrappa API Key ${idx + 1}...`}
                              className="w-full rounded-lg border border-slate-300 pl-3 pr-8 py-1.5 font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => toggleShowKey(idx)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showKeys[idx] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Credits balance badge under key */}
                        {trimmed && (
                          <div className="pl-14 text-[10px] flex items-center gap-1.5">
                            {status ? (
                              status.valid ? (
                                <span
                                  className={`px-2 py-0.5 rounded font-semibold ${
                                    status.usable > 0
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                                  }`}
                                >
                                  {status.usable > 0
                                    ? `✓ Còn ${status.usable.toLocaleString('en-US')} credits`
                                    : '⚠ 0 credits (Hết lượt)'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-semibold">
                                  ✕ {status.error || 'Key không hợp lệ'}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400">Chưa kiểm tra số dư</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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

                {/* Mock toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-semibold text-slate-800 block">Dữ liệu mẫu (Mock Fallback)</span>
                    <span className="text-[11px] text-slate-500">Tự sinh traffic mẫu khi chưa nhập key hoặc tất cả keys đều hết lượt</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={mockEnabled}
                    onChange={(e) => setMockEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {settingsSavedToast && (
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã lưu cấu hình và cập nhật số dư!</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Lưu cấu hình
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
