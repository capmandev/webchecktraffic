export interface TrafficCheckRecord {
  id: string;
  domain: string;
  monthly_traffic: number;
  checked_at: string; // ISO string
  is_starred: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DomainCheckResult {
  domain: string;
  rawInput?: string;
  monthly_traffic: number | null;
  is_starred: boolean;
  checked_at: string | null;
  status: 'cached' | 'fresh' | 'error';
  error?: string;
}

export interface CheckRequestPayload {
  domains: string[] | string;
}

export interface CheckResponsePayload {
  success: boolean;
  results: DomainCheckResult[];
  summary: {
    total: number;
    cached: number;
    fresh: number;
    errors: number;
  };
}
