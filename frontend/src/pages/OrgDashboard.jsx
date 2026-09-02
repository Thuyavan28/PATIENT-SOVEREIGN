import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { toast } from '../lib/toast';

// React Icons (ri package only)
import {
  RiDashboardLine,
  RiSearchLine,
  RiSendPlaneLine,
  RiAlertLine,
  RiBuildingLine,
  RiShieldCheckLine,
  RiTimeLine,
  RiCapsuleLine,
  RiHealthBookLine,
  RiTestTubeLine,
  RiHeartPulseLine,
  RiShieldLine,
  RiScissorsCutLine,
  RiDnaLine,
  RiCloseLine,
  RiCheckLine,
  RiEyeLine,
  RiAddLine
} from 'react-icons/ri';

import Sidebar from '../components/Sidebar';
import Loader from '../components/Loader';
import {
  RiShieldFlashLine,
  RiKeyLine,
  RiFileShieldLine,
  RiInformationLine,
  RiFlashlightLine
} from 'react-icons/ri';
import TopBar from '../components/TopBar';
import StatsCard from '../components/StatsCard';
import FraudFlagBanner from '../components/FraudFlagBanner';

export default function OrgDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  const [requests, setRequests] = useState([]);
  const [fraudFlags, setFraudFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Find Patient State
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundPatient, setFoundPatient] = useState(null);

  // Request Access Form state
  const [selectedCategories, setSelectedCategories] = useState(['allergies', 'current_medications']);
  const [purpose, setPurpose] = useState('treatment');
  const [purposeNotes, setPurposeNotes] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState('');
  const [triggeredFlags, setTriggeredFlags] = useState([]);

  // View Scoped Data Modal state
  const [viewDataModalOpen, setViewDataModalOpen] = useState(false);
  const [scopedDataPayload, setScopedDataPayload] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  const loadOrgData = async () => {
    setLoadError(null);
    try {
      // Only fetch org-scoped data — orgs cannot call /admin endpoints
      const reqRes = await api.get('/access-requests/org');
      setRequests(reqRes.data);
      setFraudFlags([]); // Fraud flags for orgs: derived from access request flags_triggered
    } catch (err) {
      console.error('Failed to load org data:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setLoadError('Session expired or access denied. Please log in again.');
      } else {
        setLoadError('Failed to connect to backend. Please ensure the server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgData();
  }, []);

  const totalRequests = requests.length;
  const approvedRequests = requests.filter((r) => r.status === 'approved' && new Date(r.expires_at) > new Date());
  const pendingRequests = requests.filter((r) => r.status === 'pending');

  // Handle Share Code Lookup
  const handleLookup = async (e, directCode = null) => {
    if (e && e.preventDefault) e.preventDefault();
    setSearchError('');
    setFoundPatient(null);
    setRequestSuccessMsg('');
    setTriggeredFlags([]);

    const cleanCode = (directCode || shareCodeInput).trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setSearchError('Share code must be exactly 6 alphanumeric characters (e.g. A1B2C3)');
      return;
    }

    setShareCodeInput(cleanCode);
    setSearching(true);
    try {
      const res = await api.get(`/patients/lookup/${cleanCode}`);
      setFoundPatient(res.data);
      toast.success(`Patient resolved: ${res.data.name} (${res.data.share_code})`);
    } catch (err) {
      setSearchError(err.response?.data?.error || 'No patient found with this share code');
      toast.error('Patient lookup failed. Verify 6-character code.');
    } finally {
      setSearching(false);
    }
  };

  const toggleCategory = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!foundPatient) return;
    if (selectedCategories.length === 0) {
      toast.error('Please select at least one data category');
      return;
    }

    setSubmittingRequest(true);
    setRequestSuccessMsg('');
    setTriggeredFlags([]);

    try {
      const res = await api.post('/access-requests', {
        share_code: foundPatient.share_code,
        data_categories: selectedCategories,
        purpose,
        purpose_notes: purposeNotes,
        duration_hours: durationHours
      });

      if (res.data.fraud_flags_triggered?.length > 0) {
        setTriggeredFlags(res.data.fraud_flags_triggered);
        toast.warning('Request submitted, but fraud rules were triggered and logged.');
      } else {
        toast.success('Access request sent. Awaiting patient PIN authorization.');
      }

      setRequestSuccessMsg(`Request sent successfully to ${foundPatient.name}. Patient must enter 4-digit PIN to release scoped data.`);
      loadOrgData();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to submit request';
      toast.error(msg);
      if (err.response?.data?.flags) {
        setTriggeredFlags(err.response.data.flags);
      }
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleViewData = async (requestId) => {
    setLoadingData(true);
    try {
      const res = await api.get(`/access-requests/${requestId}/data`);
      setScopedDataPayload(res.data);
      setViewDataModalOpen(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Access denied to patient data';
      toast.error(msg);
    } finally {
      setLoadingData(false);
    }
  };

  const categoriesConfig = [
    { id: 'allergies', label: 'Allergies', icon: RiAlertLine },
    { id: 'current_medications', label: 'Current Medications', icon: RiCapsuleLine },
    { id: 'prescriptions', label: 'Prescriptions', icon: RiHealthBookLine },
    { id: 'lab_reports', label: 'Lab Reports / Documents', icon: RiTestTubeLine },
    { id: 'diagnoses', label: 'Diagnoses & Conditions', icon: RiHeartPulseLine },
    { id: 'immunizations', label: 'Immunizations', icon: RiShieldLine },
    { id: 'surgical_history', label: 'Surgical History', icon: RiScissorsCutLine },
    { id: 'chronic_conditions', label: 'Chronic Conditions', icon: RiDnaLine }
  ];

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar currentTab={tab} setTab={setTab} />
        <TopBar breadcrumb={tab} />
        <main className="ml-[240px] pt-16 flex items-center justify-center min-h-screen">
          <Loader
            message="Loading Organization Portal..."
            subtitle="Fetching authorized patient grants and request ledger"
          />
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar currentTab={tab} setTab={setTab} />
        <TopBar breadcrumb={tab} />
        <main className="ml-[240px] pt-16 flex items-center justify-center min-h-screen">
          <div className="max-w-md text-center space-y-4 p-8 bg-white border border-black rounded-2xl">
            <RiAlertLine className="text-4xl text-[#EF4444] mx-auto" />
            <h2 className="text-base font-bold text-[#0A0A0A]">Connection Error</h2>
            <p className="text-xs text-[#555555]">{loadError}</p>
            <button
              onClick={() => { setLoading(true); loadOrgData(); }}
              className="flex items-center space-x-2 mx-auto px-4 py-2 bg-black text-white rounded-xl text-xs font-medium hover:bg-[#333333] transition-colors"
            >
              <RiShieldCheckLine className="text-sm" />
              <span>Retry Connection</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Sidebar currentTab={tab} setTab={setTab} />
      <TopBar breadcrumb={tab} />

      <main className="ml-[240px] pt-16 px-8 pb-8 max-w-[1200px] space-y-6">

        {/* Unverified Org Alert Banner */}
        {!user.org_verified && (
          <div className="bg-amber-50 border border-[#F59E0B] rounded-2xl p-5 flex items-start space-x-3">
            <RiAlertLine className="text-[#F59E0B] text-xl shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-[#0A0A0A]">
                Pending Administrator Verification
              </h4>
              <p className="text-xs text-[#555555] mt-0.5">
                Your organization is pending admin verification. Access requests will be automatically flagged with rule <span className="font-mono font-bold">UNVERIFIED_ORG</span> until verified by platform administrators.
              </p>
            </div>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Organization Portal
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Track healthcare data requests, cryptographic patient authorizations, and access scope
                </p>
              </div>
              <button
                onClick={() => setTab('find')}
                className="flex items-center space-x-1.5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <RiAddLine className="text-sm" />
                <span>+ Request Patient Access</span>
              </button>
            </div>

            {/* 4 Stat Cards Row matching Image 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Requests"
                value={totalRequests}
                subtitle="All submitted requests"
                variant="neutral"
              />
              <StatsCard
                title="Active Authorizations"
                value={`+${approvedRequests.length}`}
                subtitle="Authorized patient grants"
                variant="positive"
              />
              <StatsCard
                title="Pending Patient Approval"
                value={`-${pendingRequests.length}`}
                subtitle="Awaiting PIN signature"
                variant={pendingRequests.length > 0 ? 'warning' : 'neutral'}
              />
              <StatsCard
                title="Fraud Flags Triggered"
                value={fraudFlags.length}
                subtitle="Logged in audit chain"
                variant={fraudFlags.length > 0 ? 'negative' : 'neutral'}
              />
            </div>

            {/* Active Authorizations matching Image 2 Card Frame */}
            <div className="bg-white border border-black rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-semibold text-[#0A0A0A]">
                    Authorized Patient Grants ({approvedRequests.length})
                  </h2>
                  <p className="text-xs text-[#555555]">
                    Enforces: Authenticated Org + Valid Patient Signature + Correct Scope + Unexpired
                  </p>
                </div>
              </div>

              {approvedRequests.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#555555]">
                  No active patient authorizations granted. Use "Find Patient" to request access.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {approvedRequests.map((req) => (
                    <div key={req.id} className="py-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-[#0A0A0A] block">
                          Patient: {req.patient_name}
                        </span>
                        <div className="flex items-center space-x-2 text-xs text-[#555555] mt-1">
                          <span className="font-medium text-[#0A0A0A]">Purpose: {req.purpose}</span>
                          <span>•</span>
                          <span>Scope: {req.data_categories?.join(', ')}</span>
                          <span>•</span>
                          <span className="text-[#16A34A] font-mono">
                            Expires: {new Date(req.expires_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleViewData(req.id)}
                        disabled={loadingData}
                        className="flex items-center space-x-1.5 text-xs font-semibold border border-black bg-black text-white hover:bg-[#333333] px-4 py-2 rounded-xl transition-colors"
                      >
                        <RiEyeLine className="text-sm" />
                        <span>View Scoped Data</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: FIND PATIENT & REQUEST ACCESS */}
        {tab === 'find' && (
          <div className="space-y-6 max-w-4xl mx-auto animate-fadeSlideIn font-sans">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold font-sans text-[#0A0A0A] tracking-tight">
                  Find Patient
                </h1>
                <p className="text-xs font-normal font-sans text-[#555555] mt-1">
                  Lookup patient identity via 6-character sovereign share code
                </p>
              </div>

              {/* Demo Patient Fast-Fill Button */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-[#555555]">Demo Patient:</span>
                <button
                  type="button"
                  onClick={() => handleLookup(null, 'A1B2C3')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-black text-white rounded-xl text-xs font-medium font-sans hover:bg-[#333333] transition-colors shadow-xs"
                >
                  <RiFlashlightLine className="text-sm text-[#F59E0B]" />
                  <span>Auto-Fill Rahul (A1B2C3)</span>
                </button>
              </div>
            </div>

            {/* Search Card */}
            <div className="bg-white border border-black rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-medium font-sans text-[#0A0A0A]">
                  Enter Sovereign Share Code
                </h2>
                <span className="text-[11px] font-mono text-[#555555]">
                  Protocol: Zero-Knowledge Discovery
                </span>
              </div>
              <p className="text-xs font-normal font-sans text-[#555555] mb-4">
                Identity ≠ Authorization ≠ Access. Resolves identity confirmation only — zero medical data is exposed.
              </p>

              <form onSubmit={(e) => handleLookup(e)} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <RiSearchLine className="absolute left-3.5 top-3.5 text-[#777777] text-base" />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="ENTER 6-CHARACTER SHARE CODE (E.G. A1B2C3)"
                    value={shareCodeInput}
                    onChange={(e) => setShareCodeInput(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-4 py-3 font-mono uppercase tracking-widest text-base font-bold rounded-xl border border-black focus:ring-1 focus:ring-black"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="border border-black bg-black text-white px-8 py-3 rounded-xl text-xs font-medium font-sans hover:bg-[#333333] transition-colors disabled:opacity-50 shrink-0 flex items-center justify-center space-x-2"
                >
                  {searching ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Querying Ledger...</span>
                    </>
                  ) : (
                    <>
                      <RiSearchLine className="text-sm" />
                      <span>Find Patient</span>
                    </>
                  )}
                </button>
              </form>

              {searchError && (
                <div className="mt-3 p-3 bg-red-50 border border-[#EF4444] rounded-xl text-xs font-medium text-[#EF4444] flex items-center space-x-2 animate-fadeSlideIn">
                  <RiAlertLine className="text-base shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}
            </div>

            {/* Centered Loader when searching */}
            {searching && (
              <div className="bg-white border border-black rounded-2xl p-6 shadow-sm">
                <Loader
                  message="Resolving Patient from Sovereign Neon Ledger..."
                  subtitle="Enforcing Zero-Trust Protocol: Resolving Non-Medical Identity Metadata Only"
                />
              </div>
            )}

            {/* When No Patient Searched Yet: Rich 3-Step Zero-Trust Architecture Cards */}
            {!foundPatient && !searching && (
              <div className="space-y-6 animate-fadeSlideIn">
                {/* 3 Step Protocol Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-black rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm mb-3">
                        1
                      </div>
                      <h3 className="text-sm font-medium font-sans text-[#0A0A0A]">
                        Identity Confirmation
                      </h3>
                      <p className="text-xs font-normal font-sans text-[#555555] mt-1.5 leading-relaxed">
                        A share code only confirms the patient's identity. Zero health records, diagnoses, or lab reports are ever exposed during discovery.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-gray-100 flex items-center space-x-1.5 text-[11px] font-mono text-[#555555]">
                      <RiShieldCheckLine className="text-sm text-[#16A34A]" />
                      <span>Zero Data Leakage</span>
                    </div>
                  </div>

                  <div className="bg-white border border-black rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm mb-3">
                        2
                      </div>
                      <h3 className="text-sm font-medium font-sans text-[#0A0A0A]">
                        Granular Scope Boundary
                      </h3>
                      <p className="text-xs font-normal font-sans text-[#555555] mt-1.5 leading-relaxed">
                        You select strictly required categories (e.g. Allergies only) and an exact validity window (6h to 72h). Blanket access is cryptographically forbidden.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-gray-100 flex items-center space-x-1.5 text-[11px] font-mono text-[#555555]">
                      <RiKeyLine className="text-sm text-[#0A0A0A]" />
                      <span>Time-Bound Scoping</span>
                    </div>
                  </div>

                  <div className="bg-white border border-black rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm mb-3">
                        3
                      </div>
                      <h3 className="text-sm font-medium font-sans text-[#0A0A0A]">
                        Sovereign PIN Signature
                      </h3>
                      <p className="text-xs font-normal font-sans text-[#555555] mt-1.5 leading-relaxed">
                        Access is never granted automatically. The patient must enter their 4-digit cryptographic PIN to decrypt their RSA-2048 private key and sign the grant.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-gray-100 flex items-center space-x-1.5 text-[11px] font-mono text-[#555555]">
                      <RiFileShieldLine className="text-sm text-[#0A0A0A]" />
                      <span>RSA-PSS Verified</span>
                    </div>
                  </div>
                </div>

                {/* Active Security & Fraud Monitoring Banner */}
                <div className="bg-white border border-black rounded-2xl p-6">
                  <div className="flex items-start justify-between pb-3 border-b border-gray-100">
                    <div>
                      <h3 className="text-sm font-medium font-sans text-[#0A0A0A]">
                        Synchronous Healthcare Fraud & Telemetry Safeguards
                      </h3>
                      <p className="text-xs font-normal font-sans text-[#555555] mt-0.5">
                        Active security rules enforced in real time on all access request submissions
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-green-50 border border-[#16A34A] text-[#16A34A] rounded-full text-[10px] font-mono font-bold uppercase">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs font-sans">
                    <div className="p-3 bg-gray-50 border border-black rounded-xl">
                      <span className="font-mono font-bold text-[#0A0A0A] block">
                        Rule 1: MULTI_ORG_ATTEMPT
                      </span>
                      <p className="text-[#555555] text-[11px] mt-1">
                        Detects prescription shopping across $\ge 3$ distinct organizations within 60 minutes.
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 border border-black rounded-xl">
                      <span className="font-mono font-bold text-[#0A0A0A] block">
                        Rule 2: DUPLICATE_REQUEST
                      </span>
                      <p className="text-[#555555] text-[11px] mt-1">
                        Detects redundant access requests for the same patient within 10 minutes.
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 border border-black rounded-xl">
                      <span className="font-mono font-bold text-[#0A0A0A] block">
                        Rule 3: EXPIRED_PRESCRIPTION
                      </span>
                      <p className="text-[#555555] text-[11px] mt-1">
                        Prevents dispensing or accessing prescriptions that have passed their clinical validity date.
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 border border-black rounded-xl">
                      <span className="font-mono font-bold text-[#0A0A0A] block">
                        Rule 4: UNVERIFIED_ORG
                      </span>
                      <p className="text-[#555555] text-[11px] mt-1">
                        Automatically flags organizations awaiting administrative identity verification.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Found Patient Card & Request Form */}
            {foundPatient && (
              <div className="bg-white border border-black rounded-2xl p-6 space-y-6 animate-fadeSlideIn">
                <div className="p-4 bg-gray-50 border border-black rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-[#555555] uppercase tracking-wider block">
                      Patient Verified
                    </span>
                    <h4 className="text-base font-bold text-[#0A0A0A]">
                      {foundPatient.name}
                    </h4>
                    <span className="text-xs font-mono text-[#555555]">
                      Share Code: {foundPatient.share_code}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-[#16A34A] bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                      Requires Patient PIN Grant
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSendRequest} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-[#0A0A0A] mb-2">
                      1. Select Required Data Categories (Scope Boundary)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {categoriesConfig.map((cat) => {
                        const Icon = cat.icon;
                        const isChecked = selectedCategories.includes(cat.id);
                        return (
                          <button
                            type="button"
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                              isChecked
                                ? 'border-[#0A0A0A] bg-black text-white shadow-xs'
                                : 'border-black bg-white text-[#0A0A0A] hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="text-lg mb-2" />
                            <span className="text-xs font-medium leading-tight">
                              {cat.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
                        2. Purpose of Access
                      </label>
                      <select
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full text-xs rounded-xl"
                      >
                        <option value="treatment">Treatment / Medical Consultation</option>
                        <option value="dispense_medicine">Dispense Medicine (Pharmacy)</option>
                        <option value="insurance_claim">Insurance Claim Verification</option>
                        <option value="diagnosis_review">Diagnosis Review / Second Opinion</option>
                        <option value="lab_test">Diagnostic Lab Test</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
                        3. Duration of Access
                      </label>
                      <div className="flex space-x-1.5">
                        {[6, 12, 24, 48, 72].map((hrs) => (
                          <button
                            type="button"
                            key={hrs}
                            onClick={() => setDurationHours(hrs)}
                            className={`flex-1 py-2 text-xs font-mono rounded-xl border transition-colors ${
                              durationHours === hrs
                                ? 'bg-black text-white border-black font-semibold'
                                : 'border-black text-[#0A0A0A] hover:bg-gray-50'
                            }`}
                          >
                            {hrs}h
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
                      4. Clinical Justification / Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Assessing potential beta-lactam cross-reactivity prior to prescription dispensing"
                      value={purposeNotes}
                      onChange={(e) => setPurposeNotes(e.target.value)}
                      className="w-full text-xs rounded-xl"
                    />
                  </div>

                  {triggeredFlags.length > 0 && (
                    <FraudFlagBanner flags={triggeredFlags} />
                  )}

                  {requestSuccessMsg && (
                    <div className="p-4 bg-green-50 border border-[#16A34A] rounded-xl text-xs font-medium text-[#16A34A] flex items-center space-x-2 animate-fadeSlideIn">
                      <RiCheckLine className="text-lg" />
                      <span>{requestSuccessMsg}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submittingRequest}
                      className="border border-[#0A0A0A] bg-black text-white px-6 py-2.5 rounded-xl text-xs font-semibold hover:bg-[#333333] transition-colors disabled:opacity-50"
                    >
                      {submittingRequest ? 'Sending Request...' : 'Send Access Request'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY REQUESTS */}
        {tab === 'requests' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Requests Ledger
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Complete record of data requests submitted by {user.name}
                </p>
              </div>
            </div>

            <div className="bg-white border border-black rounded-2xl p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-200 text-[#555555] font-mono uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Patient</th>
                      <th className="py-2.5 px-3">Purpose</th>
                      <th className="py-2.5 px-3">Categories</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Expires At</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requests.map((req) => {
                      const isApproved = req.status === 'approved';
                      const isExpired = new Date(req.expires_at) <= new Date();

                      return (
                        <tr key={req.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 font-semibold text-[#0A0A0A]">{req.patient_name}</td>
                          <td className="py-3 px-3 text-[#555555] capitalize">{req.purpose}</td>
                          <td className="py-3 px-3 text-[#555555]">{req.data_categories?.join(', ')}</td>
                          <td className="py-3 px-3 font-mono text-[11px] uppercase">
                            <span className="px-2 py-0.5 rounded-full border border-gray-200">{req.status}</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[#555555]">
                            {req.expires_at ? new Date(req.expires_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isApproved && !isExpired ? (
                              <button
                                onClick={() => handleViewData(req.id)}
                                className="px-3 py-1 bg-black text-white text-xs rounded-xl hover:bg-[#333333] transition-colors"
                              >
                                View Data
                              </button>
                            ) : (
                              <span className="text-gray-400 italic text-[11px]">
                                {req.status === 'pending' ? 'Pending' : 'Closed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FRAUD ALERTS */}
        {tab === 'fraud' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Healthcare Fraud & Anomaly Alerts
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Automated detection of multi-org shopping, duplicates, and unverified organizations
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {fraudFlags.map((flag) => {
                const details = typeof flag.details === 'string'
                  ? JSON.parse(flag.details || '{}')
                  : (flag.details || {});

                return (
                  <div
                    key={flag.id}
                    className="bg-white border border-black rounded-2xl p-5 hover:border-black/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-sm text-[#0A0A0A]">
                            {flag.rule_triggered}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              flag.severity === 'high'
                                ? 'bg-red-50 text-[#EF4444] border border-red-200'
                                : 'bg-amber-50 text-[#F59E0B] border border-amber-200'
                            }`}
                          >
                            {flag.severity} severity
                          </span>
                        </div>
                        <p className="text-xs text-[#555555] mt-1">
                          {details.message || 'Anomaly flagged during access evaluation'}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-[#555555]">
                        {new Date(flag.flagged_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* VIEW SCOPED DATA MODAL — Full 3-way handshake result */}
      {viewDataModalOpen && scopedDataPayload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-black rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fadeSlideIn">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#0A0A0A] rounded-lg flex items-center justify-center">
                  <RiShieldCheckLine className="text-white text-base" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono font-bold text-[#16A34A] uppercase tracking-widest">RSA Signature Verified</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] inline-block animate-pulse" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0A0A0A] leading-tight">
                    Scoped Data — {scopedDataPayload.patient_name}
                  </h3>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-[10px] font-mono text-[#555555]">
                  Expires: {new Date(scopedDataPayload.expires_at).toLocaleString()}
                </span>
                <button onClick={() => setViewDataModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#555555] hover:text-[#0A0A0A] transition-colors">
                  <RiCloseLine className="text-lg" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">

              {/* AI Drug Safety Panel */}
              {scopedDataPayload.ai_safety && (
                <div className={`p-4 rounded-xl border space-y-3 ${
                  scopedDataPayload.ai_safety.safe
                    ? 'bg-green-50 border-[#16A34A]'
                    : 'bg-red-50 border-[#EF4444]'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <RiShieldCheckLine className={`text-base ${scopedDataPayload.ai_safety.safe ? 'text-[#16A34A]' : 'text-[#EF4444]'}`} />
                      <span className={`text-xs font-bold ${scopedDataPayload.ai_safety.safe ? 'text-[#16A34A]' : 'text-[#EF4444]'}`}>
                        AI Clinical Safety Analysis
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                      scopedDataPayload.ai_safety.safe
                        ? 'bg-white text-[#16A34A] border-[#16A34A]'
                        : 'bg-white text-[#EF4444] border-[#EF4444]'
                    }`}>
                      {scopedDataPayload.ai_safety.safe ? '✓ No Critical Interactions' : '⚠ Interactions Detected'}
                    </span>
                  </div>

                  {/* Interactions */}
                  {scopedDataPayload.ai_safety.interactions?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#555555]">Drug-Drug Interactions</p>
                      {scopedDataPayload.ai_safety.interactions.map((intx, i) => (
                        <div key={i} className="p-2.5 bg-white border border-black rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-[#0A0A0A]">{intx.drugs?.join(' + ')}</span>
                            <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                              intx.severity === 'high' ? 'bg-red-100 text-[#EF4444]' :
                              intx.severity === 'medium' ? 'bg-amber-100 text-[#F59E0B]' :
                              'bg-gray-100 text-[#555555]'
                            }`}>{intx.severity}</span>
                          </div>
                          <p className="text-[#555555] leading-relaxed">{intx.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Allergy conflicts */}
                  {scopedDataPayload.ai_safety.allergy_conflicts?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#555555]">Allergy Conflicts</p>
                      {scopedDataPayload.ai_safety.allergy_conflicts.map((ac, i) => (
                        <div key={i} className="p-2.5 bg-white border border-[#EF4444] rounded-lg">
                          <div className="flex items-center space-x-2 mb-1">
                            <RiAlertLine className="text-[#EF4444] text-sm shrink-0" />
                            <span className="font-bold text-[#0A0A0A]">{ac.drug}</span>
                            <span className="text-[#555555]">conflicts with allergy to</span>
                            <span className="font-bold text-[#EF4444]">{ac.allergy}</span>
                          </div>
                          <p className="text-[#555555] leading-relaxed">{ac.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {scopedDataPayload.ai_safety.safe && (
                    <p className="text-xs text-[#16A34A]">No critical drug-drug interactions or allergy conflicts detected in this prescription set.</p>
                  )}
                </div>
              )}

              {/* Patient Profile */}
              {scopedDataPayload.scoped_data?.patient_profile && (
                <div className="p-4 bg-gray-50 border border-black rounded-xl">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#555555] mb-3">Patient Profile</p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      ['Blood Group', scopedDataPayload.scoped_data.patient_profile.blood_group],
                      ['Gender', scopedDataPayload.scoped_data.patient_profile.gender],
                      ['Date of Birth', scopedDataPayload.scoped_data.patient_profile.date_of_birth]
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span className="text-[#555555] block mb-0.5">{label}</span>
                        <span className="font-bold text-[#0A0A0A]">{val || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prescriptions */}
              {scopedDataPayload.scoped_data?.prescriptions?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#0A0A0A] border-b border-gray-200 pb-1.5">
                    Prescriptions ({scopedDataPayload.scoped_data.prescriptions.length})
                  </h4>
                  {scopedDataPayload.scoped_data.prescriptions.map((rx, i) => (
                    <div key={i} className="p-3.5 bg-gray-50 border border-black rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#0A0A0A]">{rx.drug_name}</span>
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                          rx.status === 'active'
                            ? 'bg-green-50 text-[#16A34A] border-green-200'
                            : 'bg-gray-100 text-[#555555] border-gray-200'
                        }`}>{rx.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#555555]">
                        <span>Dosage: <span className="font-medium text-[#0A0A0A]">{rx.dosage}</span></span>
                        <span>Frequency: <span className="font-medium text-[#0A0A0A]">{rx.frequency}</span></span>
                        <span>Duration: <span className="font-medium text-[#0A0A0A]">{rx.duration}</span></span>
                      </div>
                      {rx.diagnosis && <p className="text-[#555555]">Diagnosis: <span className="font-medium text-[#0A0A0A]">{rx.diagnosis}</span></p>}
                      <div className="flex items-center justify-between text-[#777777] font-mono text-[10px]">
                        <span>Dr. {rx.doctor_name || 'Unknown'}</span>
                        <span>{rx.issued_date ? new Date(rx.issued_date).toLocaleDateString() : ''} → {rx.expiry_date ? new Date(rx.expiry_date).toLocaleDateString() : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Allergies */}
              {scopedDataPayload.scoped_data?.allergies?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#0A0A0A] border-b border-gray-200 pb-1.5">
                    Allergies ({scopedDataPayload.scoped_data.allergies.length})
                  </h4>
                  {scopedDataPayload.scoped_data.allergies.map((a, i) => (
                    <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#0A0A0A]">{a.name || a}</span>
                        {a.reaction && <span className="text-[#555555] ml-2">— {a.reaction}</span>}
                      </div>
                      {a.severity && <span className="text-[10px] font-mono font-bold uppercase text-[#EF4444]">{a.severity}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Current Medications */}
              {scopedDataPayload.scoped_data?.current_medications?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#0A0A0A] border-b border-gray-200 pb-1.5">
                    Current Medications ({scopedDataPayload.scoped_data.current_medications.length})
                  </h4>
                  {scopedDataPayload.scoped_data.current_medications.map((m, i) => (
                    <div key={i} className="p-3 bg-gray-50 border border-black rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#0A0A0A]">{m.name || m}</span>
                        {m.dosage && <span className="text-[#555555] ml-2">{m.dosage} · {m.frequency}</span>}
                      </div>
                      {m.prescribed_by && <span className="text-[10px] text-[#555555] font-mono">Dr. {m.prescribed_by}</span>}
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-black shrink-0">
              <div className="flex items-center space-x-1.5 text-[10px] font-mono text-[#555555]">
                <RiShieldCheckLine className="text-xs" />
                <span>Identity ≠ Authorization ≠ Access · Strictly scoped release</span>
              </div>
              <button
                onClick={() => setViewDataModalOpen(false)}
                className="px-5 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333333] transition-colors"
              >
                Close Data View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

