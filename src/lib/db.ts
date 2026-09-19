import fs from 'fs';
import path from 'path';
import { getSupabaseClient } from './supabase';
import { TrafficCheckRecord } from './types';

// Fallback local file path for local persistence when Supabase credentials are not yet configured
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
        console.error('Supabase query error:', error.message);
        throw new Error('Unable to load saved data');
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
      console.warn('Falling back to local cache due to Supabase query error');
    }
  }

  // Fallback to local storage
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
      const payload: Partial<TrafficCheckRecord> = {
        domain,
        monthly_traffic: monthlyTraffic,
        checked_at: now,
        is_starred: isStarred,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('traffic_checks')
        .upsert(payload, { onConflict: 'domain' })
        .select('*')
        .single();

      if (error) {
        console.error('Supabase upsert error:', error.message);
        throw new Error('Database error during save');
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
    } catch (err) {
      console.warn('Falling back to local storage for upsert');
    }
  }

  // Fallback local storage
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
        console.error('Supabase getAll error:', error.message);
        throw new Error('Unable to load saved data');
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
      console.warn('Falling back to local db for getAllRecords');
    }
  }

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
        throw error;
      }
      return true;
    } catch (err) {
      console.warn('Falling back to local db for updateStar');
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
        throw error;
      }
      return count || domains.length;
    } catch (err) {
      console.warn('Falling back to local db for deleteRecords');
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
