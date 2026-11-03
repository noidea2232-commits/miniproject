// TAPORAA TRANSIT PLATFORM — COMPREHENSIVE PHASE 5 TEST SUITE
// Tests all 14 verification points specified in project requirements.

const BASE_URL = 'http://127.0.0.1:3000';
const DEVICE_TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaqqqqqqqqqqqqqqqqqqqqqqqwwwwwwwwwwwwwwwwwwwwwww';
const ADMIN_PASSCODE = 'taporaa-admin-2026';

const results = [];

function recordTest(id, name, passed, details) {
  results.push({ id, name, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] Test #${id}: ${name}`);
  if (details) console.log(`       Details: ${details}`);
}

async function runAllTests() {
  console.log('========================================================');
  console.log('   TAPORAA TRANSIT SYSTEM — PHASE 5 COMPLETE TEST SUITE ');
  console.log('========================================================\n');

  // Test 1: Existing Passenger Lookup
  try {
    const res = await fetch(`${BASE_URL}/api/device/passenger-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-token': DEVICE_TOKEN },
      body: JSON.stringify({ fingerprint_id: 1 })
    });
    const data = await res.json();
    const passed = res.status === 200 && data.success && data.passenger.name === 'Manish';
    recordTest(1, 'Existing passenger lookup (Manish, FP#1)', passed, `Status: ${res.status}, Name: ${data.passenger?.name}, Balance: ₹${data.passenger?.wallet_balance}`);
  } catch (e) {
    recordTest(1, 'Existing passenger lookup', false, e.message);
  }

  // Test 2: Fingerprint Enrollment API & Database Mapping
  try {
    const enrollRes = await fetch(`${BASE_URL}/api/admin/passenger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-passcode': ADMIN_PASSCODE },
      body: JSON.stringify({
        name: 'Phase5 Verified Commuter',
        fingerprint_id: 18,
        wallet_balance: 350,
        phone: '+91 98450 18181',
        email: 'phase5.commuter@taporaa.transit'
      })
    });
    const enrollData = await enrollRes.json();
    const passed = (enrollRes.status === 200 || enrollRes.status === 201) && enrollData.success;
    recordTest(2, 'Fingerprint enrollment and database mapping (FP#18)', passed, `Status: ${enrollRes.status}, Created passenger ID: ${enrollData.passenger?.id}`);
  } catch (e) {
    recordTest(2, 'Fingerprint enrollment and database mapping', false, e.message);
  }

  // Test 3: Registered Fingerprint Recognition
  try {
    const res = await fetch(`${BASE_URL}/api/device/passenger-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-token': DEVICE_TOKEN },
      body: JSON.stringify({ fingerprint_id: 18 })
    });
    const data = await res.json();
    const passed = res.status === 200 && data.passenger?.name === 'Phase5 Verified Commuter';
    recordTest(3, 'Registered fingerprint recognition (FP#18)', passed, `Status: ${res.status}, Recognized name: ${data.passenger?.name}`);
  } catch (e) {
    recordTest(3, 'Registered fingerprint recognition', false, e.message);
  }

  // Test 4: Unknown Fingerprint Handling & Security Event
  try {
    const res = await fetch(`${BASE_URL}/api/device/passenger-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-token': DEVICE_TOKEN },
      body: JSON.stringify({ fingerprint_id: 999 })
    });
    const passed = res.status === 404;

    const alertRes = await fetch(`${BASE_URL}/api/hardware/unknown-fingerprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-token': DEVICE_TOKEN },
      body: JSON.stringify({ device_id: 'TEST-GATE-ALERT', station_id: 1 })
    });

    recordTest(4, 'Unknown fingerprint handling (rejected with 404, security alert created)', passed && alertRes.status === 200, `Lookup status: ${res.status}, Alert trigger: ${alertRes.status}`);
  } catch (e) {
    recordTest(4, 'Unknown fingerprint handling', false, e.message);
  }

  // Test 5: Check-in & Active Journey Creation
  let activeJourneyId = null;
  try {
    const res = await fetch(`${BASE_URL}/api/device/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-token': DEVICE_TOKEN },
      body: JSON.stringify({
        fingerprint_id: 18,
        station_id: 1, // Majestic
        gate_type: 'entry',
        device_id: 'ESP32-GATE-MAJ-01'
      })
    });
    const data = await res.json();
    activeJourneyId = data.journey?.id;
    const passed = res.status === 201 && data.gate_command === 'OPEN' && data.action === 'check_in';
    recordTest(5, 'Check-in and active journey display (Majestic station)', passed, `Status: ${res.status}, Gate: ${data.gate_command}, Journey Code: ${data.journey?.journey_code}`);
  } catch (e) {
    recordTest(5, 'Check-in and active journey display', false, e.message);
  }

  // Test 6: Check-out & Completed Journey Display
  let fareCharged = 0;
  try {
    const res = await fetch(`${BASE_URL}/api/device/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-token': DEVICE_TOKEN },
      body: JSON.stringify({
        fingerprint_id: 18,
        station_id: 2, // Indiranagar
        gate_type: 'exit',
        device_id: 'ESP32-GATE-IDN-02'
      })
    });
    const data = await res.json();
    fareCharged = data.fare_deducted;
    const passed = res.status === 200 && data.gate_command === 'OPEN' && data.journey?.status === 'COMPLETED';
    recordTest(6, 'Checkout and completed journey display (Indiranagar exit)', passed, `Status: ${res.status}, Gate: ${data.gate_command}, Fare: ₹${fareCharged}`);
  } catch (e) {
    recordTest(6, 'Checkout and completed journey display', false, e.message);
  }

  // Test 7: Correct Fare Deduction and Wallet Balance Persistence
  try {
    const res = await fetch(`${BASE_URL}/api/passengers/TAP-PASS-18`);
    const data = await res.json();
    const expected = 350 - 15; // 350 initial - 15 fare
    const passed = data.passenger?.wallet_balance === expected;
    recordTest(7, 'Correct fare deduction and wallet balance persistence', passed, `Initial: ₹350, Expected: ₹${expected}, Actual: ₹${data.passenger?.wallet_balance}`);
  } catch (e) {
    recordTest(7, 'Correct fare deduction and wallet balance persistence', false, e.message);
  }

  // Test 8: Repeated Checkout and Duplicate-Charge Prevention
  try {
    const res = await fetch(`${BASE_URL}/api/device/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-token': DEVICE_TOKEN },
      body: JSON.stringify({
        fingerprint_id: 18,
        station_id: 2,
        gate_type: 'exit'
      })
    });
    const data = await res.json();
    const passed = res.status === 400 && data.code === 'NO_ACTIVE_JOURNEY';
    recordTest(8, 'Repeated checkout and duplicate-charge prevention', passed, `Status: ${res.status}, Code: ${data.code}, Gate command: ${data.gate_command}`);
  } catch (e) {
    recordTest(8, 'Repeated checkout prevention', false, e.message);
  }

  // Test 9: Passenger App Refresh & Reopening During Active Journey
  try {
    // Check in again
    await fetch(`${BASE_URL}/api/edge/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passenger_id: 'TAP-PASS-18', fingerprint_id: 18, station_id: 3 })
    });
    // Now simulate passenger app reload (fetch passenger profile)
    const res = await fetch(`${BASE_URL}/api/passengers/TAP-PASS-18`);
    const data = await res.json();
    const passed = data.active_journey !== null && data.active_journey?.entry_station_name.includes('MG Road');

    // Clean up: complete the test journey
    await fetch(`${BASE_URL}/api/edge/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passenger_id: 'TAP-PASS-18', fingerprint_id: 18, station_id: 1 })
    });

    recordTest(9, 'Passenger app refresh during active journey', passed, `Active journey found on reload: ${!!data.active_journey}, Station: ${data.active_journey?.entry_station_name}`);
  } catch (e) {
    recordTest(9, 'Passenger app refresh during active journey', false, e.message);
  }

  // Test 10: Operation Center Passenger Names and Journey History
  try {
    const res = await fetch(`${BASE_URL}/api/journeys?limit=10`);
    const data = await res.json();
    const allHaveRealNames = data.journeys?.length > 0 && !data.journeys.some((j) => j.passenger_name === 'Unknown');
    const hasKushal = data.journeys.some((j) => j.passenger_name === 'KUSHAL');
    recordTest(10, 'Operation Center passenger names (no Unknown records)', allHaveRealNames, `Loaded ${data.journeys?.length} journeys, all real names, Kushal present: ${hasKushal}`);
  } catch (e) {
    recordTest(10, 'Operation Center passenger names', false, e.message);
  }

  // Test 11: Device Monitor Events and Status
  try {
    const devRes = await fetch(`${BASE_URL}/api/admin/devices`, {
      headers: { 'x-admin-passcode': ADMIN_PASSCODE }
    });
    const devData = await devRes.json();
    const eventsRes = await fetch(`${BASE_URL}/api/admin/device-events?limit=5`, {
      headers: { 'x-admin-passcode': ADMIN_PASSCODE }
    });
    const eventsData = await eventsRes.json();
    const passed = devData.success && eventsData.success && eventsData.events?.length > 0;
    recordTest(11, 'Device Monitor events and status stream', passed, `Devices count: ${devData.total_devices}, Events stream count: ${eventsData.events?.length}`);
  } catch (e) {
    recordTest(11, 'Device Monitor events and status', false, e.message);
  }

  // Test 12: API Authentication and Security Gates
  try {
    const resNoToken = await fetch(`${BASE_URL}/api/device/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint_id: 1, station_id: 1 })
    });
    const resWrongToken = await fetch(`${BASE_URL}/api/device/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-token': 'wrong-fake-token' },
      body: JSON.stringify({ fingerprint_id: 1, station_id: 1 })
    });
    const passed = resNoToken.status === 401 && resWrongToken.status === 401;
    recordTest(12, 'API authentication, unauthorized token rejection (401)', passed, `Missing token status: ${resNoToken.status}, Invalid token status: ${resWrongToken.status}`);
  } catch (e) {
    recordTest(12, 'API authentication', false, e.message);
  }

  // Test 13: Frontend Static Serving and Production Health Check
  try {
    const resHealth = await fetch(`${BASE_URL}/api/health`);
    const healthData = await resHealth.json();
    const resHtml = await fetch(`${BASE_URL}/`);
    const htmlText = await resHtml.text();
    const passed = resHealth.status === 200 && healthData.status === 'healthy' && htmlText.includes('Taporaa');
    recordTest(13, 'Frontend production build serving & backend health check', passed, `Health status: ${healthData.status}, Uptime: ${healthData.uptime_seconds}s, HTML serves Vite SPA: ${passed}`);
  } catch (e) {
    recordTest(13, 'Frontend production build serving', false, e.message);
  }

  // Test 14: Stations and Fare Matrix Integrity
  try {
    const res = await fetch(`${BASE_URL}/api/stations`);
    const data = await res.json();
    const passed = data.stations?.length === 8 && data.fare_rules?.length >= 8;
    recordTest(14, 'Stations and fare matrix integrity (Purple line network)', passed, `Stations: ${data.stations?.length}, Fare rules: ${data.fare_rules?.length}`);
  } catch (e) {
    recordTest(14, 'Stations and fare matrix integrity', false, e.message);
  }

  // Clean up: delete test passenger FP#18 to preserve pristine database
  try {
    await fetch(`${BASE_URL}/api/admin/passenger/TAP-PASS-18?force=true`, {
      method: 'DELETE',
      headers: { 'x-admin-passcode': ADMIN_PASSCODE }
    });
    console.log('\n[CLEANUP] Test commuter FP#18 safely removed after verification.');
  } catch {}

  console.log('\n========================================================');
  const passCount = results.filter((r) => r.passed).length;
  console.log(`TEST RESULTS: ${passCount} / ${results.length} PASSED (${((passCount/results.length)*100).toFixed(0)}%)`);
  console.log('========================================================\n');
}

runAllTests().catch(console.error);
