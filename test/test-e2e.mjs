import assert from 'node:assert/strict';

const BASE_URL = 'http://127.0.0.1:3001';

async function waitServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return true;
    } catch (e) {
      // waiting
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function runTests() {
  console.log('1. Waiting for local server to be ready at', BASE_URL);
  await waitServer(BASE_URL);
  console.log('Server is online!');

  // Test 1: Single domain check
  console.log('\n2. Testing Single Domain Check: https://www.example.com/');
  const res1 = await fetch(`${BASE_URL}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domains: 'https://www.example.com/' }),
  });
  const data1 = await res1.json();
  assert.equal(data1.success, true);
  assert.equal(data1.results.length, 1);
  assert.equal(data1.results[0].domain, 'example.com');
  assert.equal(typeof data1.results[0].monthly_traffic, 'number');
  assert.equal(data1.results[0].monthly_traffic > 0, true);
  assert.equal(data1.results[0].status, 'fresh');
  console.log('✓ Single domain checked successfully:', data1.results[0]);

  // Test 2: 30-day cache hit verification and bulk check
  console.log('\n3. Testing 30-Day Cache Hit and Bulk Deduplication...');
  const bulkInput = `
    https://example.com
    www.test.com/
    https://abc.com/page
    xyz.com
    example.com
  `;
  const res2 = await fetch(`${BASE_URL}/api/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domains: bulkInput }),
  });
  const data2 = await res2.json();
  assert.equal(data2.success, true);
  // Should have deduplicated example.com (total unique valid: example.com, test.com, abc.com, xyz.com -> 4)
  assert.equal(data2.results.length, 4);

  const exampleRes = data2.results.find((r) => r.domain === 'example.com');
  assert.ok(exampleRes);
  assert.equal(exampleRes.status, 'cached', 'example.com was checked just moments ago, MUST hit cache (<30 days)');
  console.log('✓ CACHE HIT VERIFIED: example.com was served from cache without calling API!');

  // Test 3: History API
  console.log('\n4. Testing History API /api/history...');
  const resHistory = await fetch(`${BASE_URL}/api/history`);
  const dataHistory = await resHistory.json();
  assert.equal(dataHistory.success, true);
  assert.ok(dataHistory.records.length >= 4);
  console.log(`✓ History returned ${dataHistory.records.length} records`);

  // Test 4: Star / Unstar API
  console.log('\n5. Testing Star Toggle /api/star...');
  const resStar = await fetch(`${BASE_URL}/api/star`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: 'example.com', is_starred: true }),
  });
  const dataStar = await resStar.json();
  assert.equal(dataStar.success, true);
  assert.equal(dataStar.is_starred, true);

  // Verify in history that star is preserved
  const resHist2 = await fetch(`${BASE_URL}/api/history`);
  const dataHist2 = await resHist2.json();
  const starredExample = dataHist2.records.find((r) => r.domain === 'example.com');
  assert.equal(starredExample.is_starred, true);
  console.log('✓ Star toggle verified and persisted!');

  // Test 5: Single & Bulk Delete API
  console.log('\n6. Testing Delete API /api/delete...');
  const resDelete = await fetch(`${BASE_URL}/api/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domains: ['xyz.com'] }),
  });
  const dataDelete = await resDelete.json();
  assert.equal(dataDelete.success, true);
  assert.equal(dataDelete.deletedCount, 1);

  const resHist3 = await fetch(`${BASE_URL}/api/history`);
  const dataHist3 = await resHist3.json();
  const deletedXyz = dataHist3.records.find((r) => r.domain === 'xyz.com');
  assert.equal(deletedXyz, undefined, 'xyz.com must be deleted');
  console.log('✓ Deletion verified!');

  console.log('\n=============================================');
  console.log('🎉 ALL END-TO-END ACCEPTANCE TESTS PASSED! 🎉');
  console.log('=============================================\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
