/**
 * Scrappa / Scarpa Traffic API Adapter (SimilarWeb Data)
 * Documentation: https://scrappa.co/docs/api#/operations/similarweb.data
 * Server-side only - Keeps API keys secure.
 * Supports up to 5 keys with automatic failover/rotation when a key runs out of quota.
 * 
 * TUYỆT ĐỐI KHÔNG BỊA SỐ LIỆU: Chỉ trả về số liệu thực từ Scrappa Similarweb API.
 * Nếu không có API Key, key hết lượt hoặc domain không có dữ liệu, trả về error rõ ràng.
 */

export interface ScarpaTrafficResult {
  monthlyTraffic: number | null;
  error?: string;
  usedKey?: string;
  exhaustedKeys?: string[];
}

export interface ScarpaConfigOptions {
  apiKeys?: string[];
  apiKey?: string;
  endpoint?: string;
}

// Parse monthly visits from Scrappa response format
function parseMonthlyTraffic(data: any): number | null {
  if (!data || typeof data !== 'object') return null;

  // 1. Check estimated_monthly_visits (map of date -> numeric visits)
  if (data.estimated_monthly_visits && typeof data.estimated_monthly_visits === 'object') {
    const dates = Object.keys(data.estimated_monthly_visits).sort();
    if (dates.length > 0) {
      const latestDate = dates[dates.length - 1];
      const val = data.estimated_monthly_visits[latestDate];
      if (typeof val === 'number' && !isNaN(val)) {
        return Math.round(val);
      }
    }
  }

  // 2. Check engagement.visits (e.g. "1.2M", "350K", "1250000", or number)
  if (data.engagement?.visits !== undefined && data.engagement?.visits !== null) {
    const raw = data.engagement.visits;
    if (typeof raw === 'number' && !isNaN(raw)) {
      return Math.round(raw);
    }
    if (typeof raw === 'string') {
      const str = raw.trim().toUpperCase().replace(/,/g, '');
      if (str.endsWith('B')) return Math.round(parseFloat(str) * 1_000_000_000);
      if (str.endsWith('M')) return Math.round(parseFloat(str) * 1_000_000);
      if (str.endsWith('K')) return Math.round(parseFloat(str) * 1_000);
      const parsed = parseFloat(str);
      if (!isNaN(parsed)) return Math.round(parsed);
    }
  }

  // 3. Fallback to direct keys if returned
  const direct =
    data.monthly_traffic ??
    data.monthlyTraffic ??
    data.traffic ??
    data.visits ??
    data?.data?.monthly_traffic;

  if (typeof direct === 'number' && !isNaN(direct)) {
    return Math.round(direct);
  }

  return null;
}

/**
 * Fetch monthly traffic for a normalized domain with automatic multi-key rotation.
 * If Key 1 hits 401/402/429/quota error, automatically moves to Key 2, Key 3, etc.
 * Tuyệt đối KHÔNG giả lập / bịa dữ liệu dưới bất kỳ hình thức nào.
 */
export async function fetchScarpaTraffic(
  domain: string,
  options?: ScarpaConfigOptions
): Promise<ScarpaTrafficResult> {
  const defaultEndpoint = 'https://scrappa.co/api/similarweb';
  const endpoint = options?.endpoint?.trim() || process.env.SCARPA_API_ENDPOINT || defaultEndpoint;

  // Build list of candidate API keys (up to 5 keys)
  const candidateKeys: string[] = [];

  if (options?.apiKeys && Array.isArray(options.apiKeys)) {
    for (const k of options.apiKeys) {
      if (typeof k === 'string' && k.trim()) {
        candidateKeys.push(k.trim());
      }
    }
  }

  if (options?.apiKey?.trim() && !candidateKeys.includes(options.apiKey.trim())) {
    candidateKeys.push(options.apiKey.trim());
  }

  // Fallback to server env variables if no UI keys provided
  if (candidateKeys.length === 0) {
    const envKeys = process.env.SCARPA_API_KEYS;
    if (envKeys) {
      const parsed = envKeys.split(',').map((k) => k.trim()).filter(Boolean);
      candidateKeys.push(...parsed);
    }
    const singleEnvKey = process.env.SCARPA_API_KEY?.trim();
    if (singleEnvKey && !candidateKeys.includes(singleEnvKey)) {
      candidateKeys.push(singleEnvKey);
    }
  }

  // If no keys configured at all: báo lỗi rõ ràng, KHÔNG tạo số ngẫu nhiên
  if (candidateKeys.length === 0) {
    return {
      monthlyTraffic: null,
      error: 'Chưa cấu hình Scrappa API Key. Vui lòng bấm Cấu hình API để nhập key.',
    };
  }

  const exhaustedKeys: string[] = [];
  let lastErrorMessage = 'Không thể lấy dữ liệu traffic';

  // Rotate through candidate keys
  for (let i = 0; i < candidateKeys.length; i++) {
    const currentKey = candidateKeys[i];

    try {
      const url = new URL(endpoint);
      url.searchParams.set('domain', domain);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-KEY': currentKey,
          'Authorization': `Bearer ${currentKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      });

      // Check quota / credit exhaustion / rate limit / invalid key
      if (response.status === 401) {
        exhaustedKeys.push(currentKey);
        lastErrorMessage = 'API key không hợp lệ hoặc sai key';
        console.warn(`Key #${i + 1} unauthorized (401), switching to next key...`);
        continue;
      }

      if (response.status === 402 || response.status === 429) {
        exhaustedKeys.push(currentKey);
        lastErrorMessage = response.status === 429 ? 'API bị giới hạn lượt gọi (Rate limit)' : 'API key đã hết credits / quota';
        console.warn(`Key #${i + 1} out of credits (${response.status}), switching to next key...`);
        continue;
      }

      if (!response.ok) {
        lastErrorMessage = `Lỗi API HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();

      // Check if response contains an error indicating quota limit or invalid key
      if (data?.error || data?.message) {
        const msg = String(data.error || data.message).toLowerCase();
        if (msg.includes('credit') || msg.includes('quota') || msg.includes('limit') || msg.includes('unauthorized') || msg.includes('key')) {
          exhaustedKeys.push(currentKey);
          console.warn(`Key #${i + 1} quota exhausted according to response body, switching to next key...`);
          continue;
        }

        // Other domain-specific error from Similarweb (e.g. domain not found / not enough data)
        return {
          monthlyTraffic: null,
          error: data.error || data.message || 'Không có dữ liệu Similarweb cho domain này',
          usedKey: currentKey,
          exhaustedKeys,
        };
      }

      const traffic = parseMonthlyTraffic(data);

      if (traffic !== null) {
        return {
          monthlyTraffic: traffic,
          usedKey: currentKey,
          exhaustedKeys,
        };
      }

      // If domain has no traffic data on Similarweb
      return {
        monthlyTraffic: null,
        error: 'Không có dữ liệu traffic trên Similarweb',
        usedKey: currentKey,
        exhaustedKeys,
      };
    } catch (err: unknown) {
      console.error(`Error requesting ${domain} with key #${i + 1}:`, err);
      if (err instanceof Error && err.name === 'TimeoutError') {
        lastErrorMessage = 'Timeout kết nối API';
      }
    }
  }

  // All keys exhausted or failed: tuyệt đối không fallback sang mock data
  return {
    monthlyTraffic: null,
    error: exhaustedKeys.length > 0 ? 'Tất cả API keys đã hết lượt (quota) hoặc không hợp lệ' : lastErrorMessage,
    exhaustedKeys,
  };
}
