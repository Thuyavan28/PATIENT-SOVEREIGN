import 'dotenv/config';

const BASE_URL = 'http://localhost:3001/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runAllTests() {
  console.log('====================================================');
  console.log('  RxVault Comprehensive End-to-End System Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  // 1. Health Endpoint
  console.log('\n--- 1. API Health Check ---');
  const health = await request('/health');
  assert(health.status === 200 && (health.data.status === 'ok' || health.data.status === 'healthy'), 'GET /api/health');

  // 2. Patient Auth & Profile
  console.log('\n--- 2. Patient Auth & Profile ---');
  const patientLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'rahul@patient.com', password: 'Patient@123' })
  });
  assert(patientLogin.status === 200 && patientLogin.data.token, 'Patient Login (rahul@patient.com)');
  const patientToken = patientLogin.data.token;
  const patientHeaders = { Authorization: `Bearer ${patientToken}` };

  const patientMe = await request('/auth/me', { headers: patientHeaders });
  assert(patientMe.status === 200 && patientMe.data.user?.role === 'patient', 'GET /api/auth/me (Patient)');

  // 3. Health Vault Access
  console.log('\n--- 3. Health Vault ---');
  const vault = await request('/vault', { headers: patientHeaders });
  assert(vault.status === 200 && vault.data.blood_group === 'O+', 'GET /api/vault');

  // 4. Prescriptions (Create, List, Verify, Delete)
  console.log('\n--- 4. Prescriptions Lifecycle ---');
  const createRx = await request('/prescriptions', {
    method: 'POST',
    headers: patientHeaders,
    body: JSON.stringify({
      drug_name: 'Amoxicillin 500mg',
      dosage: '500mg',
      frequency: '3 times daily',
      duration: '7 days',
      doctor_name: 'Dr. Test Physician',
      doctor_reg: 'REG-999',
      diagnosis: 'Bacterial Infection',
      issued_date: '2026-09-02',
      expiry_date: '2026-09-09',
      pin: '1234'
    })
  });
  assert(createRx.status === 201 && createRx.data.id, 'POST /api/prescriptions (Sign with PIN)');
  const createdRxId = createRx.data?.id;

  const listRx = await request('/prescriptions', { headers: patientHeaders });
  assert(listRx.status === 200 && Array.isArray(listRx.data), 'GET /api/prescriptions');

  if (createdRxId) {
    const verifyRx = await request(`/prescriptions/${createdRxId}/verify`, { headers: patientHeaders });
    assert(
      verifyRx.status === 200 && verifyRx.data.signature_valid === true && verifyRx.data.hash_match === true,
      'GET /api/prescriptions/:id/verify (RSA & SHA-256 Intact)'
    );

    const deleteRxWrongPin = await request(`/prescriptions/${createdRxId}`, {
      method: 'DELETE',
      headers: patientHeaders,
      body: JSON.stringify({ pin: '9999' })
    });
    assert(deleteRxWrongPin.status === 403, 'DELETE /api/prescriptions/:id with Wrong PIN rejects (403)');

    const deleteRx = await request(`/prescriptions/${createdRxId}`, {
      method: 'DELETE',
      headers: patientHeaders,
      body: JSON.stringify({ pin: '1234' })
    });
    assert(deleteRx.status === 200 && deleteRx.data.success === true, 'DELETE /api/prescriptions/:id with Valid PIN (200 OK)');
  }

  // 5. Medical Documents
  console.log('\n--- 5. Medical Documents ---');
  const listDocs = await request('/documents', { headers: patientHeaders });
  assert(listDocs.status === 200 && Array.isArray(listDocs.data), 'GET /api/documents');

  // 6. Organization Workflow (Pharmacy)
  console.log('\n--- 6. Organization Workflow (Pharmacy) ---');
  const orgLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'metro@pharmacy.com', password: 'Pharmacy@123' })
  });
  assert(orgLogin.status === 200 && orgLogin.data.token, 'Org Login (metro@pharmacy.com)');
  const orgToken = orgLogin.data.token;
  const orgHeaders = { Authorization: `Bearer ${orgToken}` };

  const lookup = await request('/patients/lookup/A1B2C3', { headers: orgHeaders });
  assert(lookup.status === 200 && (lookup.data.name === 'Rahul Sharma' || lookup.data.patient_name === 'Rahul Sharma'), 'GET /api/patients/lookup/A1B2C3');

  const createAccess = await request('/access-requests', {
    method: 'POST',
    headers: orgHeaders,
    body: JSON.stringify({
      share_code: 'A1B2C3',
      purpose: 'dispense_medicine',
      purpose_notes: 'Automated Test Dispensation Check',
      duration_hours: 24,
      data_categories: ['allergies', 'current_medications', 'prescriptions']
    })
  });
  assert(createAccess.status === 201 && (createAccess.data.id || createAccess.data.request_id), 'POST /api/access-requests (Request 3-Way Handshake Step 1)');
  const accessRequestId = createAccess.data?.id || createAccess.data?.request_id;

  // 7. Patient Approves Access Request (Handshake Step 2)
  console.log('\n--- 7. Patient Approval & RSA Signing ---');
  const pendingRequests = await request('/access-requests/pending', { headers: patientHeaders });
  assert(pendingRequests.status === 200 && Array.isArray(pendingRequests.data), 'GET /api/access-requests/pending');

  if (accessRequestId) {
    const approveReq = await request(`/access-requests/${accessRequestId}/approve`, {
      method: 'POST',
      headers: patientHeaders,
      body: JSON.stringify({ pin: '1234' })
    });
    assert(approveReq.status === 200 && approveReq.data.success === true, 'POST /api/access-requests/:id/approve (RSA Signed)');
  }

  // 8. Org Accesses Scoped Data + Live AI Safety (Step 3)
  console.log('\n--- 8. Org Scoped Data Access + AI Safety Check ---');
  if (accessRequestId) {
    const orgData = await request(`/access-requests/${accessRequestId}/data`, { headers: orgHeaders });
    assert(
      orgData.status === 200 && orgData.data.rsa_signature_verified === true,
      'GET /api/access-requests/:id/data (RSA Verified)'
    );
    assert(
      orgData.data.ai_safety && typeof orgData.data.ai_safety.risk_score === 'number',
      `AI Clinical Safety Engine Active (Risk Score: ${orgData.data.ai_safety?.risk_score}/100, Level: ${orgData.data.ai_safety?.risk_level})`
    );
  }

  // 9. Patient Revokes Access Immediately
  console.log('\n--- 9. Patient Access Revocation ---');
  if (accessRequestId) {
    const revokeReq = await request(`/access-requests/${accessRequestId}/revoke`, {
      method: 'POST',
      headers: patientHeaders,
      body: JSON.stringify({ reason: 'Test complete', pin: '1234' })
    });
    assert(revokeReq.status === 200 && revokeReq.data.success === true, 'POST /api/access-requests/:id/revoke with PIN (200 OK)');

    const orgBlocked = await request(`/access-requests/${accessRequestId}/data`, { headers: orgHeaders });
    assert(orgBlocked.status === 403 && orgBlocked.data.error === 'authorization_revoked', 'Org blocked after Revocation (403)');
  }

  // 10. Role Isolation & Forbidden Route Tests
  console.log('\n--- 10. Role Separation & Forbidden Error Security Tests ---');
  const orgVault = await request('/vault', { headers: orgHeaders });
  assert(orgVault.status === 403, 'Org forbidden from accessing /api/vault (403)');

  const patientLookup = await request('/patients/lookup/A1B2C3', { headers: patientHeaders });
  assert(patientLookup.status === 403, 'Patient forbidden from accessing /api/patients/lookup (403)');

  const unauth = await request('/audit/my');
  assert(unauth.status === 401, 'Unauthenticated access rejected (401)');

  console.log('\n====================================================');
  console.log(`  Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
