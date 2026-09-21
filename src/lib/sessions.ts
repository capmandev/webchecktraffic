import { getSupabaseClient } from './supabase';

export interface ScanSessionItem {
  domain: string;
  monthly_traffic: number | null;
  status?: string;
  is_starred?: boolean;
  checked_at?: string | null;
  error?: string;
}

export interface ScanSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  domainsCount: number;
  totalTraffic: number;
  items: ScanSessionItem[];
}

export function generateDefaultSessionName(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `Quét lúc ${hours}:${minutes} - ${day}/${month}/${year}`;
}

/**
 * Get all saved scan sessions from Supabase.
 */
export async function getAllScanSessions(): Promise<ScanSession[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  try {
    // 1. Check dedicated scan_sessions table if it exists
    const { data: dedicatedData, error: dedicatedError } = await supabase
      .from('scan_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!dedicatedError && dedicatedData && Array.isArray(dedicatedData)) {
      return dedicatedData.map((row: any) => ({
        id: String(row.id),
        name: String(row.name || ''),
        createdAt: String(row.created_at || new Date().toISOString()),
        updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
        domainsCount: Number(row.domains_count ?? (Array.isArray(row.items) ? row.items.length : 0)),
        totalTraffic: Number(row.total_traffic ?? 0),
        items: Array.isArray(row.items) ? row.items : [],
      }));
    }

    // 2. Fallback: stored in traffic_checks with prefix __SESSION__:
    const { data: slotData, error: slotError } = await supabase
      .from('traffic_checks')
      .select('id, domain, monthly_traffic, checked_at, created_at, updated_at')
      .like('domain', '__SESSION__:%')
      .order('checked_at', { ascending: false });

    if (!slotError && slotData && Array.isArray(slotData)) {
      const sessions: ScanSession[] = [];
      for (const row of slotData) {
        try {
          const raw = String(row.domain);
          const separatorIdx = raw.indexOf('::');
          if (separatorIdx !== -1) {
            const jsonStr = raw.substring(separatorIdx + 2);
            const parsed = JSON.parse(jsonStr);
            sessions.push({
              id: parsed.id || row.id,
              name: parsed.name || 'Lần quét không tên',
              createdAt: parsed.createdAt || row.checked_at || row.created_at,
              updatedAt: parsed.updatedAt || row.updated_at,
              domainsCount: Number(parsed.domainsCount || (Array.isArray(parsed.items) ? parsed.items.length : row.monthly_traffic)),
              totalTraffic: Number(parsed.totalTraffic || 0),
              items: Array.isArray(parsed.items) ? parsed.items : [],
            });
          }
        } catch (parseErr) {
          console.error('Error parsing session row:', parseErr);
        }
      }
      return sessions;
    }
  } catch (err) {
    console.error('Exception fetching scan sessions:', err);
  }

  return [];
}

/**
 * Save a new scan session to Supabase.
 */
export async function createScanSession(
  name: string,
  items: ScanSessionItem[]
): Promise<ScanSession | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const finalName = name && name.trim() ? name.trim() : generateDefaultSessionName();
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  let totalTraffic = 0;
  for (const item of items) {
    if (typeof item.monthly_traffic === 'number' && !isNaN(item.monthly_traffic)) {
      totalTraffic += item.monthly_traffic;
    }
  }

  const sessionObj: ScanSession = {
    id: sessionId,
    name: finalName,
    createdAt: now,
    updatedAt: now,
    domainsCount: items.length,
    totalTraffic,
    items,
  };

  try {
    // 1. Try dedicated scan_sessions table
    const { data: dedicatedData, error: dedicatedError } = await supabase
      .from('scan_sessions')
      .insert({
        id: sessionId,
        name: finalName,
        domains_count: items.length,
        total_traffic: totalTraffic,
        items,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (!dedicatedError && dedicatedData) {
      return sessionObj;
    }

    // 2. Storage in traffic_checks table
    const payloadText = `__SESSION__:${sessionId}::${JSON.stringify(sessionObj)}`;
    const { error: insertErr } = await supabase.from('traffic_checks').insert({
      domain: payloadText,
      monthly_traffic: items.length,
      checked_at: now,
      created_at: now,
      updated_at: now,
    });

    if (insertErr) {
      console.error('Error saving scan session into traffic_checks:', insertErr.message);
      return null;
    }

    return sessionObj;
  } catch (err) {
    console.error('Exception creating scan session:', err);
    return null;
  }
}

/**
 * Rename an existing scan session.
 */
export async function renameScanSession(id: string, newName: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !id || !newName.trim()) {
    return false;
  }

  const trimmedName = newName.trim();
  const now = new Date().toISOString();

  try {
    // 1. Try dedicated table
    const { error: dedicatedError } = await supabase
      .from('scan_sessions')
      .update({ name: trimmedName, updated_at: now })
      .eq('id', id);

    if (!dedicatedError) {
      return true;
    }

    // 2. Fallback in traffic_checks
    const { data: rows } = await supabase
      .from('traffic_checks')
      .select('id, domain')
      .like('domain', `__SESSION__:${id}::%`);

    if (rows && rows.length > 0) {
      const oldRow = rows[0];
      const separatorIdx = oldRow.domain.indexOf('::');
      if (separatorIdx !== -1) {
        const jsonStr = oldRow.domain.substring(separatorIdx + 2);
        const parsed = JSON.parse(jsonStr);
        parsed.name = trimmedName;
        parsed.updatedAt = now;
        const newDomain = `__SESSION__:${id}::${JSON.stringify(parsed)}`;

        const { error: updateErr } = await supabase
          .from('traffic_checks')
          .update({ domain: newDomain, updated_at: now })
          .eq('id', oldRow.id);

        return !updateErr;
      }
    }
  } catch (err) {
    console.error('Error renaming scan session:', err);
  }

  return false;
}

/**
 * Delete a scan session by ID.
 */
export async function deleteScanSession(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !id) {
    return false;
  }

  try {
    // 1. Try dedicated table
    const { error: dedicatedErr } = await supabase
      .from('scan_sessions')
      .delete()
      .eq('id', id);

    if (!dedicatedErr) {
      return true;
    }

    // 2. Fallback in traffic_checks
    const { error: deleteErr } = await supabase
      .from('traffic_checks')
      .delete()
      .like('domain', `__SESSION__:${id}::%`);

    return !deleteErr;
  } catch (err) {
    console.error('Error deleting scan session:', err);
    return false;
  }
}
