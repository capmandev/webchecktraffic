/**
 * Domain Normalization and Validation according to SPEC Section 4.
 */

// Regular expression to validate standard domain syntax (e.g., example.com, sub.domain.co.uk)
// Must have at least one dot, valid hostname characters, and TLD with at least 2 alpha characters
const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

/**
 * Normalizes a single raw domain/URL string:
 * - Trim whitespace
 * - Lowercase
 * - Remove http://, https://, //
 * - Remove www.
 * - Remove path, query string, fragment
 * - Remove trailing slashes
 * - Validate domain format
 */
export function normalizeDomain(raw: string): { domain: string | null; error?: string } {
  if (!raw || typeof raw !== 'string') {
    return { domain: null, error: 'Empty input' };
  }

  let cleaned = raw.trim().toLowerCase();

  // Strip protocol (http://, https://, or //)
  cleaned = cleaned.replace(/^(?:https?:)?\/\//i, '');

  // Strip path, query string, fragment
  // Everything after the first '/', '?', or '#' belongs to path/query/fragment
  cleaned = cleaned.split(/[/?#]/)[0];

  // Strip port if present (e.g., example.com:8080)
  cleaned = cleaned.split(':')[0];

  // Strip leading www.
  cleaned = cleaned.replace(/^www\./i, '');

  // Strip trailing slash or dots
  cleaned = cleaned.replace(/[./]+$/, '');

  if (!cleaned) {
    return { domain: null, error: 'Invalid domain' };
  }

  // Validate format
  if (cleaned.length > 253 || !DOMAIN_REGEX.test(cleaned)) {
    return { domain: null, error: 'Invalid domain' };
  }

  return { domain: cleaned };
}

/**
 * Parses single or bulk domain input from textarea/string/array.
 * Splits by newlines, commas, or semicolons.
 * Normalizes each entry and deduplicates while preserving order.
 */
export function parseAndNormalizeBulk(input: string | string[]): {
  validDomains: string[];
  invalidEntries: { raw: string; error: string }[];
} {
  let lines: string[] = [];

  if (Array.isArray(input)) {
    lines = input;
  } else if (typeof input === 'string') {
    lines = input.split(/[\r\n,;]+/);
  }

  const validDomains: string[] = [];
  const seen = new Set<string>();
  const invalidEntries: { raw: string; error: string }[] = [];

  for (const item of lines) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    const { domain, error } = normalizeDomain(trimmed);

    if (domain) {
      if (!seen.has(domain)) {
        seen.add(domain);
        validDomains.push(domain);
      }
    } else {
      invalidEntries.push({
        raw: trimmed,
        error: error || 'Invalid domain',
      });
    }
  }

  return { validDomains, invalidEntries };
}

/**
 * Check if the 30-day cache is still valid.
 * SPEC Section 7:
 * If < 30 days -> use cache (DO NOT call Scarpa API)
 * If >= 30 days -> expired (call Scarpa API)
 */
export function isCacheValid(checkedAt: string | Date | null | undefined, maxDays = 30): boolean {
  if (!checkedAt) return false;

  const checkDate = new Date(checkedAt);
  if (isNaN(checkDate.getTime())) return false;

  const diffMs = Date.now() - checkDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays < maxDays;
}
