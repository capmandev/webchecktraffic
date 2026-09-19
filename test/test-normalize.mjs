import assert from 'node:assert/strict';

// Test domain regex and logic inline for node test
const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

function normalizeDomain(raw) {
  if (!raw || typeof raw !== 'string') {
    return { domain: null, error: 'Empty input' };
  }

  let cleaned = raw.trim().toLowerCase();
  cleaned = cleaned.replace(/^(?:https?:)?\/\//i, '');
  cleaned = cleaned.split(/[/?#]/)[0];
  cleaned = cleaned.split(':')[0];
  cleaned = cleaned.replace(/^www\./i, '');
  cleaned = cleaned.replace(/[./]+$/, '');

  if (!cleaned) {
    return { domain: null, error: 'Invalid domain' };
  }

  if (cleaned.length > 253 || !DOMAIN_REGEX.test(cleaned)) {
    return { domain: null, error: 'Invalid domain' };
  }

  return { domain: cleaned };
}

function parseAndNormalizeBulk(input) {
  let lines = [];
  if (Array.isArray(input)) {
    lines = input;
  } else if (typeof input === 'string') {
    lines = input.split(/[\r\n,;]+/);
  }

  const validDomains = [];
  const seen = new Set();
  const invalidEntries = [];

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

function isCacheValid(checkedAt, maxDays = 30) {
  if (!checkedAt) return false;
  const checkDate = new Date(checkedAt);
  if (isNaN(checkDate.getTime())) return false;
  const diffMs = Date.now() - checkDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays < maxDays;
}

// 1. Single domain normalizations from SPEC
console.log('Testing Single Domain Normalization...');
assert.equal(normalizeDomain('https://www.example.com/').domain, 'example.com');
assert.equal(normalizeDomain('https://WWW.Example.com/abc?test=1#section').domain, 'example.com');
assert.equal(normalizeDomain('www.test.com/').domain, 'test.com');
assert.equal(normalizeDomain('https://abc.com/page').domain, 'abc.com');
assert.equal(normalizeDomain('xyz.com').domain, 'xyz.com');
assert.equal(normalizeDomain('   HTTP://sub.DOMAIN.co.uk/test?a=1   ').domain, 'sub.domain.co.uk');

// 2. Invalid domains
console.log('Testing Invalid Domain Rejection...');
assert.equal(normalizeDomain('invalid_domain').domain, null);
assert.equal(normalizeDomain('http://').domain, null);
assert.equal(normalizeDomain('').domain, null);
assert.equal(normalizeDomain('   ').domain, null);
assert.equal(normalizeDomain('notadomain').domain, null);

// 3. Bulk input parsing & deduplication
console.log('Testing Bulk Input Deduplication & Order Preservation...');
const bulkInput = `
https://example.com
www.test.com/
https://abc.com/page
xyz.com
example.com
`;
const bulkRes = parseAndNormalizeBulk(bulkInput);
assert.deepEqual(bulkRes.validDomains, ['example.com', 'test.com', 'abc.com', 'xyz.com']);

// 4. 30-day cache validity
console.log('Testing 30-day Cache Validity Rule...');
const now = Date.now();
const twentyDaysAgo = new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString();
const thirtyOneDaysAgo = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
const exactlyTwentyNineDaysAgo = new Date(now - 29 * 24 * 60 * 60 * 1000).toISOString();

assert.equal(isCacheValid(twentyDaysAgo), true, '20 days ago should be valid cache');
assert.equal(isCacheValid(exactlyTwentyNineDaysAgo), true, '29 days ago should be valid cache');
assert.equal(isCacheValid(thirtyOneDaysAgo), false, '31 days ago should be expired cache');
assert.equal(isCacheValid(null), false, 'null should be invalid cache');

console.log('ALL NORMALIZATION & CACHE TESTS PASSED!');
