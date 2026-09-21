import { getSupabaseClient } from './supabase';
import { TrafficCheckRecord } from './types';

/**
 * Retrieve database records for a list of domains from Supabase.
 */
export async function getRecordsByDomains(
  domains: string[]
): Promise<Map<string, TrafficCheckRecord>> {
  const resultMap = new Map<string, TrafficCheckRecord>();
  if (domains.length === 0) return resultMap;

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('getRecordsByDomains: Supabase client not initialized');
    return resultMap;
  }

  try {
    const { data, error } = await supabase
      .from('traffic_checks')
      .select('*')
      .in('domain', domains);

    if (error) {
      console.error('Supabase query error in getRecordsByDomains:', error.message);
      return resultMap;
    }

    if (data) {
      for (const row of data) {
        resultMap.set(row.domain, {
          id: row.id,
          domain: row.domain,
          monthly_traffic: Number(row.monthly_traffic),
          checked_at: row.checked_at,
          is_starred: Boolean(row.is_starred),
          created_at: row.created_at,
          updated_at: row.updated_at,
        });
      }
    }
  } catch (err) {
    console.error('Exception in getRecordsByDomains:', err);
  }

  return resultMap;
}

/**
 * Insert or update a traffic check record in Supabase.
 * Preserves is_starred state if already present.
 */
export async function upsertRecord(
  domain: string,
  monthlyTraffic: number,
  existingRecord?: TrafficCheckRecord | null
): Promise<TrafficCheckRecord> {
  const now = new Date().toISOString();
  const isStarred = existingRecord ? existingRecord.is_starred : false;

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('upsertRecord: Supabase client not initialized');
    return {
      id: `err-${Date.now()}`,
      domain,
      monthly_traffic: monthlyTraffic,
      checked_at: now,
      is_starred: isStarred,
      created_at: now,
      updated_at: now,
    };
  }

  const payload: Record<string, any> = {
    domain,
    monthly_traffic: monthlyTraffic,
    checked_at: now,
    is_starred: isStarred,
    updated_at: now,
  };

  if (!existingRecord) {
    payload.created_at = now;
  }

  const { data, error } = await supabase
    .from('traffic_checks')
    .upsert(payload, { onConflict: 'domain' })
    .select()
    .single();

  if (error) {
    console.error('Supabase upsertRecord error:', error.message);
    return {
      id: `err-${Date.now()}`,
      domain,
      monthly_traffic: monthlyTraffic,
      checked_at: now,
      is_starred: isStarred,
      created_at: now,
      updated_at: now,
    };
  }

  return {
    id: data.id,
    domain: data.domain,
    monthly_traffic: Number(data.monthly_traffic),
    checked_at: data.checked_at,
    is_starred: Boolean(data.is_starred),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Retrieve all traffic checks from Supabase, sorted by checked_at descending.
 */
export async function getAllRecords(): Promise<TrafficCheckRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('getAllRecords: Supabase client not initialized');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('traffic_checks')
      .select('*')
      .not('domain', 'like', '\\_\\_%')
      .order('checked_at', { ascending: false });

    if (error) {
      console.error('Supabase getAllRecords error:', error.message);
      return [];
    }

    return (data || [])
      .filter((row) => row.domain && !row.domain.startsWith('__'))
      .map((row) => ({
        id: row.id,
        domain: row.domain,
        monthly_traffic: Number(row.monthly_traffic),
        checked_at: row.checked_at,
        is_starred: Boolean(row.is_starred),
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
  } catch (err) {
    console.error('Exception in Supabase getAllRecords:', err);
    return [];
  }
}

/**
 * Toggle or update is_starred status for a domain in Supabase.
 */
export async function updateStar(domain: string, isStarred: boolean): Promise<boolean> {
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('traffic_checks')
      .update({ is_starred: isStarred, updated_at: now })
      .eq('domain', domain);

    if (error) {
      console.error('Supabase updateStar error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception in Supabase updateStar:', err);
    return false;
  }
}

/**
 * Delete records by domain name list in Supabase.
 */
export async function deleteRecords(domains: string[]): Promise<number> {
  const safeDomains = domains.filter((d) => d && !d.startsWith('__'));
  if (safeDomains.length === 0) return 0;

  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  try {
    const { error, count } = await supabase
      .from('traffic_checks')
      .delete({ count: 'exact' })
      .in('domain', safeDomains);

    if (error) {
      console.error('Supabase deleteRecords error:', error.message);
      return 0;
    }
    return count || domains.length;
  } catch (err) {
    console.error('Exception in Supabase deleteRecords:', err);
    return 0;
  }
}
