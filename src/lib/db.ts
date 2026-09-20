import fs from 'fs';
import path from 'path';
import { getSupabaseClient } from './supabase';
import { TrafficCheckRecord } from './types';

// Fallback local file path ONLY when Supabase credentials are not configured at all
const LOCAL_DB_PATH = path.join(process.cwd(), '.local-traffic-db.json');

function readLocalDb(): Map<string, TrafficCheckRecord> {
  const map = new Map<string, TrafficCheckRecord>();
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      const list: TrafficCheckRecord[] = JSON.parse(raw);
      for (const item of list) {
        map.set(item.domain, item);
      }
    }
  } catch (err) {
    console.error('Error reading local fallback db:', err);
  }
  return map;
}

function writeLocalDb(map: Map<string, TrafficCheckRecord>): void {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local fallback db:', err);
  }
}

/**
 * Retrieve database records for a list of domains.
 */
export async function getRecordsByDomains(
  domains: string[]
): Promise<Map<string, TrafficCheckRecord>> {
  const resultMap = new Map<string, TrafficCheckRecord>();
  if (domains.length === 0) return resultMap;

  const supabase = getSupabaseClient();
  if (supabase) {
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
      return resultMap;
    } catch (err) {
      console.error('Exception in Supabase getRecordsByDomains:', err);
      return resultMap;
    }
  }

  // Pure offline mode
  const localMap = readLocalDb();
  for (const domain of domains) {
    const rec = localMap.get(domain);
    if (rec) {
      resultMap.set(domain, rec);
    }
  }
  return resultMap;
}

/**
 * Insert or update a traffic check record.
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
  if (supabase) {
    try {
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
      } else if (data) {
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
    } catch (err) {
      console.error('Exception in Supabase upsertRecord:', err);
    }
  }

  // Offline fallback
  const localMap = readLocalDb();
  const record: TrafficCheckRecord = {
    id: existingRecord?.id || `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    domain,
    monthly_traffic: monthlyTraffic,
    checked_at: now,
    is_starred: isStarred,
    created_at: existingRecord?.created_at || now,
    updated_at: now,
  };
  localMap.set(domain, record);
  writeLocalDb(localMap);
  return record;
}

/**
 * Retrieve all traffic checks from database, sorted by checked_at descending.
 */
export async function getAllRecords(): Promise<TrafficCheckRecord[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('traffic_checks')
        .select('*')
        .order('checked_at', { ascending: false });

      if (error) {
        console.error('Supabase getAllRecords error:', error.message);
        return [];
      }

      return (data || []).map((row) => ({
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

  // Pure offline mode
  const localMap = readLocalDb();
  const records = Array.from(localMap.values());
  records.sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime());
  return records;
}

/**
 * Toggle or update is_starred status for a domain.
 */
export async function updateStar(domain: string, isStarred: boolean): Promise<boolean> {
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();

  if (supabase) {
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

  const localMap = readLocalDb();
  const record = localMap.get(domain);
  if (record) {
    record.is_starred = isStarred;
    record.updated_at = now;
    localMap.set(domain, record);
    writeLocalDb(localMap);
    return true;
  }
  return false;
}

/**
 * Delete records by domain name list.
 */
export async function deleteRecords(domains: string[]): Promise<number> {
  if (domains.length === 0) return 0;

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error, count } = await supabase
        .from('traffic_checks')
        .delete({ count: 'exact' })
        .in('domain', domains);

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

  const localMap = readLocalDb();
  let deleted = 0;
  for (const domain of domains) {
    if (localMap.delete(domain)) {
      deleted++;
    }
  }
  writeLocalDb(localMap);
  return deleted;
}
