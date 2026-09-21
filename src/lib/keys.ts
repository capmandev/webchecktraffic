import { getSupabaseClient } from './supabase';

export const MAX_TEAM_KEYS = 10;
export const DEFAULT_ENDPOINT = 'https://scrappa.co/api/similarweb';

export interface TeamApiKeysConfig {
  keys: string[];
  endpoint: string;
}

/**
 * Retrieve the shared 10 API keys from Supabase.
 */
export async function getTeamApiKeys(): Promise<TeamApiKeysConfig> {
  const result: TeamApiKeysConfig = {
    keys: Array(MAX_TEAM_KEYS).fill(''),
    endpoint: DEFAULT_ENDPOINT,
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    // Fallback to environment variables if Supabase is not configured
    const envKeys = process.env.SCARPA_API_KEYS;
    if (envKeys) {
      const parsed = envKeys.split(',').map((k) => k.trim()).filter(Boolean);
      for (let i = 0; i < Math.min(parsed.length, MAX_TEAM_KEYS); i++) {
        result.keys[i] = parsed[i];
      }
    } else if (process.env.SCARPA_API_KEY) {
      result.keys[0] = process.env.SCARPA_API_KEY.trim();
    }
    return result;
  }

  try {
    // 1. First attempt: check dedicated team_api_keys table
    const { data: dedicatedData, error: dedicatedError } = await supabase
      .from('team_api_keys')
      .select('slot_index, api_key');

    if (!dedicatedError && dedicatedData && Array.isArray(dedicatedData)) {
      for (const row of dedicatedData) {
        const slot = Number(row.slot_index);
        if (slot >= 0 && slot < MAX_TEAM_KEYS && row.api_key) {
          result.keys[slot] = String(row.api_key).trim();
        }
      }
      return result;
    }

    // 2. Second attempt: read slots stored in traffic_checks
    const { data: slotData, error: slotError } = await supabase
      .from('traffic_checks')
      .select('domain')
      .or('domain.like.__KEY_SLOT_%,domain.like.__TEAM_ENDPOINT_%');

    if (!slotError && slotData && Array.isArray(slotData)) {
      for (const row of slotData) {
        const text = String(row.domain);
        if (text.startsWith('__KEY_SLOT_')) {
          // Format: __KEY_SLOT_<i>__:<key>
          const match = text.match(/^__KEY_SLOT_(\d+)__:(.+)$/);
          if (match) {
            const slot = parseInt(match[1], 10);
            const key = match[2].trim();
            if (slot >= 0 && slot < MAX_TEAM_KEYS) {
              result.keys[slot] = key;
            }
          }
        } else if (text.startsWith('__TEAM_ENDPOINT__:')) {
          const endpointVal = text.substring('__TEAM_ENDPOINT__:'.length).trim();
          if (endpointVal) {
            result.endpoint = endpointVal;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching team API keys from Supabase:', err);
  }

  // Fallback to server env variables if no keys were found in DB
  const hasDbKey = result.keys.some((k) => k.length > 0);
  if (!hasDbKey) {
    const envKeys = process.env.SCARPA_API_KEYS;
    if (envKeys) {
      const parsed = envKeys.split(',').map((k) => k.trim()).filter(Boolean);
      for (let i = 0; i < Math.min(parsed.length, MAX_TEAM_KEYS); i++) {
        result.keys[i] = parsed[i];
      }
    } else if (process.env.SCARPA_API_KEY) {
      result.keys[0] = process.env.SCARPA_API_KEY.trim();
    }
  }

  return result;
}

/**
 * Save the shared 10 API keys to Supabase for the entire team.
 */
export async function saveTeamApiKeys(
  keys: string[],
  endpoint?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Cannot save team API keys: Supabase is not connected');
    return false;
  }

  const cleanKeys = Array(MAX_TEAM_KEYS).fill('');
  for (let i = 0; i < Math.min(keys.length, MAX_TEAM_KEYS); i++) {
    cleanKeys[i] = typeof keys[i] === 'string' ? keys[i].trim() : '';
  }

  const cleanEndpoint = endpoint && endpoint.trim() ? endpoint.trim() : DEFAULT_ENDPOINT;

  try {
    // 1. Try updating dedicated team_api_keys table if it exists
    const { error: dedicatedTest } = await supabase
      .from('team_api_keys')
      .select('id')
      .limit(1);

    if (!dedicatedTest) {
      // Table exists: update slots in dedicated table
      await supabase.from('team_api_keys').delete().neq('slot_index', -1);
      const toInsert: { slot_index: number; api_key: string }[] = [];
      for (let idx = 0; idx < cleanKeys.length; idx++) {
        if (cleanKeys[idx]) {
          toInsert.push({ slot_index: idx, api_key: cleanKeys[idx] });
        }
      }
      if (toInsert.length > 0) {
        await supabase.from('team_api_keys').insert(toInsert);
      }
      return true;
    }

    // 2. Storage in traffic_checks table
    // Delete existing key slot rows
    await supabase
      .from('traffic_checks')
      .delete()
      .like('domain', '__KEY_SLOT_%');

    await supabase
      .from('traffic_checks')
      .delete()
      .like('domain', '__TEAM_ENDPOINT_%');

    const toInsert = [];
    for (let i = 0; i < MAX_TEAM_KEYS; i++) {
      if (cleanKeys[i]) {
        toInsert.push({
          domain: `__KEY_SLOT_${i}__:${cleanKeys[i]}`,
          monthly_traffic: 0,
        });
      }
    }

    if (cleanEndpoint && cleanEndpoint !== DEFAULT_ENDPOINT) {
      toInsert.push({
        domain: `__TEAM_ENDPOINT__:${cleanEndpoint}`,
        monthly_traffic: 0,
      });
    }

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('traffic_checks').insert(toInsert);
      if (insertErr) {
        console.error('Error inserting team API keys into traffic_checks:', insertErr.message);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('Exception saving team API keys:', err);
    return false;
  }
}
