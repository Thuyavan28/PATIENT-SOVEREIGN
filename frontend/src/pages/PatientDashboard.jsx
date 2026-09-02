import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { toast } from '../lib/toast';

// React Icons (ri package only)
import {
  RiDashboardLine,
  RiHospitalLine,
  RiHealthBookLine,
  RiFolderLine,
  RiBellLine,
  RiShieldCheckLine,
  RiUserLine,
  RiAddLine,
  RiUploadCloudLine,
  RiCloseLine,
  RiAlertLine,
  RiTimeLine,
  RiDownloadLine,
  RiSearchLine,
  RiCalendarLine,
  RiCapsuleLine,
  RiHeartPulseLine,
  RiScissorsCutLine,
  RiDnaLine,
  RiShieldLine,
  RiRefreshLine
} from 'react-icons/ri';

// Components
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import StatsCard from '../components/StatsCard';
import ShareCodeDisplay from '../components/ShareCodeDisplay';
import VaultSection from '../components/VaultSection';
import PrescriptionCard from '../components/PrescriptionCard';
import DocumentCard from '../components/DocumentCard';
import AccessRequestCard from '../components/AccessRequestCard';
import AuditTable from '../components/AuditTable';
import CryptoProcessPopup from '../components/CryptoProcessPopup';
import PinInput from '../components/PinInput';
import DrugWarningBanner from '../components/DrugWarningBanner';
import Loader from '../components/Loader';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  // Data states
  const [vault, setVault] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rxLoading, setRxLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modals & Slide-over states
  const [rxSlideOverOpen, setRxSlideOverOpen] = useState(false);
  const [uploadDocModalOpen, setUploadDocModalOpen] = useState(false);
  const [cryptoPopupOpen, setCryptoPopupOpen] = useState(false);
  const [approvalResult, setApprovalResult] = useState(null);
  const [recentAiWarnings, setRecentAiWarnings] = useState(null);

  // New Prescription Form state
  const [newRx, setNewRx] = useState({
    drug_name: '',
    dosage: '',
    frequency: '',
    duration: '',
    doctor_name: '',
    doctor_reg: '',
    diagnosis: '',
    notes: '',
    issued_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    pin: ''
  });
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [rxPinError, setRxPinError] = useState(false);

  // New Document Upload Form state
  const [newDoc, setNewDoc] = useState({
    title: '',
    document_type: 'lab_report',
    description: '',
    file_name: '',
    mime_type: '',
    file_data: ''
  });
  const [docFilePreview, setDocFilePreview] = useState(null);
  const [docSubmitting, setDocSubmitting] = useState(false);


  // Vault basic profile form state
  const [profileForm, setProfileForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  // Change PIN state
  const [changePinData, setChangePinData] = useState({ currentPin: '', newPin: '', confirmPin: '' });
  const [changePinLoading, setChangePinLoading] = useState(false);

  // Load all patient data
  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [vRes, rxRes, docRes, pendRes, histRes, audRes] = await Promise.all([
        api.get('/vault'),
        api.get('/prescriptions'),
        api.get('/documents'),
        api.get('/access-requests/pending'),
        api.get('/access-requests/history'),
        api.get('/audit/my')
      ]);

      setVault(vRes.data);
      setProfileForm(vRes.data);
      setPrescriptions(rxRes.data);
      setDocuments(docRes.data);
      setPendingRequests(pendRes.data);
      setRequestHistory(histRes.data);
      setAuditLogs(audRes.data);
    } catch (err) {
      console.error('Failed to load patient dashboard data:', err);
      setLoadError('Failed to connect to RxVault backend. Please check that the backend server is running on port 3001.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const activeAuthorizations = requestHistory.filter((r) => {
    return r.status === 'approved' && new Date(r.expires_at) > new Date();
  });

  // Basic Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.put('/vault', profileForm);
      setVault(res.data);
      toast.success('Medical profile updated and recorded in audit trail');
    } catch (err) {
      toast.error('Failed to update medical profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Structured Lists: Add & Remove
  const handleAddVaultItem = async (section, data) => {
    try {
      const res = await api.post(`/vault/${section}`, data);
      setVault(res.data.vault);
      toast.success(`Entry added to ${section}`);
      loadData();
    } catch (err) {
      toast.error(`Failed to add entry to ${section}`);
      throw err;
    }
  };

  const handleRemoveVaultItem = async (section, index) => {
    try {
      const res = await api.delete(`/vault/${section}/${index}`);
      setVault(res.data.vault);
      toast.success(`Entry removed from ${section}`);
      loadData();
    } catch (err) {
      toast.error(`Failed to remove entry from ${section}`);
    }
  };

  // Prescription Create & Cryptographic Sign
  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    if (newRx.pin.length !== 4) {
      setRxPinError('PIN must be 4 digits');
      return;
    }
    setRxPinError(false);
    setRxSubmitting(true);
    try {
      const res = await api.post('/prescriptions', newRx);
      setPrescriptions((prev) => [res.data, ...prev]);

      const warnings = typeof res.data.ai_warnings === 'string'
        ? JSON.parse(res.data.ai_warnings || '{}')
        : res.data.ai_warnings;

      setRecentAiWarnings(warnings);

      if (warnings && warnings.safe === false) {
        toast.warning('Prescription cryptographically signed. Clinical safety warnings detected!');
      } else {
        toast.success('Prescription cryptographically signed and added to hash chain');
      }

      setNewRx({
        drug_name: '',
        dosage: '',
        frequency: '',
        duration: '',
        doctor_name: '',
        doctor_reg: '',
        diagnosis: '',
        notes: '',
        issued_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        pin: ''
      });
      setRxSlideOverOpen(false);
      loadData();
    } catch (err) {
      if (err.response?.data?.error === 'invalid_pin') {
        setRxPinError('Incorrect 4-digit PIN');
      } else {
        toast.error(err.response?.data?.error || 'Failed to create prescription');
      }
    } finally {
      setRxSubmitting(false);
    }
  };

  // Document File selection handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target.result;
      setNewDoc((prev) => ({
        ...prev,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        file_data: base64Data,
        title: prev.title || file.name.replace(/\.[^/.]+$/, '')
      }));

      if (file.type.startsWith('image/')) {
        setDocFilePreview(base64Data);
      } else {
        setDocFilePreview(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Document Upload Submit — no PIN needed, JWT authentication is sufficient
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!newDoc.file_data) {
      toast.error('Please select a file to upload');
      return;
    }
    if (!newDoc.title.trim()) {
      toast.error('Please enter a document title');
      return;
    }
    setDocSubmitting(true);
    try {
      const payload = {
        title: newDoc.title,
        document_type: newDoc.document_type,
        description: newDoc.description,
        file_name: newDoc.file_name,
        mime_type: newDoc.mime_type,
        file_data: newDoc.file_data
      };
      const res = await api.post('/documents', payload);
      setDocuments((prev) => [res.data, ...prev]);
      toast.success('Document uploaded with SHA-256 integrity hash');
      setNewDoc({
        title: '',
        document_type: 'lab_report',
        description: '',
        file_name: '',
        mime_type: '',
        file_data: ''
      });
      setDocFilePreview(null);
      setUploadDocModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to upload document');
    } finally {
      setDocSubmitting(false);
    }
  };


  // Access Request Approval
  const handleApproveRequest = async (requestId, pin) => {
    try {
      const res = await api.post(`/access-requests/${requestId}/approve`, { pin });
      setApprovalResult(res.data);
      setCryptoPopupOpen(true);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
      throw err;
    }
  };

  // Access Request Reject
  const handleRejectRequest = async (requestId) => {
    try {
      await api.post(`/access-requests/${requestId}/reject`);
      toast.info('Access request rejected');
      loadData();
    } catch (err) {
      toast.error('Failed to reject request');
    }
  };

  // Access Request Revoke
  const handleRevokeAuthorization = async (requestId, reason, pin) => {
    try {
      await api.post(`/access-requests/${requestId}/revoke`, { reason, pin });
      toast.success('Access authorization revoked immediately');
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to revoke access';
      if (err.response?.data?.error === 'invalid_pin') {
        toast.error('Incorrect PIN — revocation cancelled');
      } else {
        toast.error(msg);
      }
      throw err;
    }
  };


  // Change PIN handler
  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    if (changePinData.newPin !== changePinData.confirmPin) {
      toast.error('New PIN and confirmation PIN do not match');
      return;
    }
    if (changePinData.newPin.length !== 4) {
      toast.error('PIN must be 4 digits');
      return;
    }

    setChangePinLoading(true);
    try {
      await api.post('/auth/change-pin', {
        currentPin: changePinData.currentPin,
        newPin: changePinData.newPin
      });
      toast.success('PIN updated and sovereign RSA keys re-encrypted');
      setChangePinData({ currentPin: '', newPin: '', confirmPin: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change PIN');
    } finally {
      setChangePinLoading(false);
    }
  };

  // Download all sovereign data
  const handleDownloadAllData = () => {
    api.get('/patient/export-data', { responseType: 'blob' })
      .then((res) => {
        const link = document.createElement('a');
        const url = window.URL.createObjectURL(new Blob([res.data]));
        link.href = url;
        link.setAttribute('download', `rxvault_full_export_${user.share_code}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Complete sovereign data export downloaded');
      })
      .catch(() => toast.error('Export failed'));
  };

  // Filtered Prescriptions
  const filteredPrescriptions = prescriptions.filter((rx) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      rx.drug_name.toLowerCase().includes(query) ||
      rx.doctor_name.toLowerCase().includes(query) ||
      (rx.diagnosis && rx.diagnosis.toLowerCase().includes(query))
    );
  });

  // Full-screen loader while initial data is being fetched
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar currentTab={tab} setTab={setTab} pendingCount={0} />
        <TopBar breadcrumb={tab} />
        <main className="ml-[240px] pt-16 flex items-center justify-center min-h-screen">
          <Loader
            message="Loading Your Sovereign Health Vault..."
            subtitle="Decrypting encrypted ledger data from Neon Cloud Database"
          />
        </main>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar currentTab={tab} setTab={setTab} pendingCount={0} />
        <TopBar breadcrumb={tab} />
        <main className="ml-[240px] pt-16 flex items-center justify-center min-h-screen">
          <div className="max-w-md text-center space-y-4 p-8 bg-white border border-black rounded-2xl">
            <RiAlertLine className="text-4xl text-[#EF4444] mx-auto" />
            <h2 className="text-base font-bold text-[#0A0A0A]">Backend Connection Failed</h2>
            <p className="text-xs text-[#555555]">{loadError}</p>
            <button
              onClick={() => { setLoading(true); loadData(); }}
              className="flex items-center space-x-2 mx-auto px-4 py-2 bg-black text-white rounded-xl text-xs font-medium hover:bg-[#333333] transition-colors"
            >
              <RiRefreshLine className="text-sm" />
              <span>Retry Connection</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Sidebar currentTab={tab} setTab={setTab} pendingCount={pendingRequests.length} />
      <TopBar breadcrumb={tab} />

      <main className="ml-[240px] pt-16 px-8 pb-8 max-w-[1200px] space-y-6">

        {/* TAB 1: OVERVIEW / DASHBOARD */}
        {tab === 'overview' && (
          <div className="space-y-6 animate-fadeSlideIn">
            {/* Page Header matching Image 2: Main title Inter Bold 700, Subtitle Inter Regular 400, Button Inter Medium 500 */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold font-sans text-[#0A0A0A] tracking-tight">
                  Sovereign Health Dashboard
                </h1>
                <p className="text-xs font-normal font-sans text-[#555555] mt-1">
                  Track sovereign health records, cryptographic hash chain and access grants
                </p>
              </div>
              <button
                onClick={() => setRxSlideOverOpen(true)}
                className="flex items-center space-x-1.5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white px-4 py-2 rounded-xl text-xs font-medium font-sans transition-colors"
              >
                <RiAddLine className="text-sm" />
                <span>+ Add Prescription</span>
              </button>
            </div>

            {/* 4 Stat Cards Row: Headings Medium 500, Numbers Bold 700, Subtitles Regular 400 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Prescriptions"
                value={prescriptions.length}
                subtitle="Chained & RSA signed"
                variant="neutral"
              />
              <StatsCard
                title="Active Data Grants"
                value={`+${activeAuthorizations.length}`}
                subtitle="Approved organization scope"
                variant="positive"
              />
              <StatsCard
                title="Pending Requests"
                value={`-${pendingRequests.length}`}
                subtitle="Awaiting sovereign PIN"
                variant={pendingRequests.length > 0 ? 'warning' : 'neutral'}
              />
              <StatsCard
                title="Secure Documents"
                value={`+${documents.length}`}
                subtitle="SHA-256 verified files"
                variant="positive"
              />
            </div>

            {/* Share Code Card */}
            <ShareCodeDisplay shareCode={user.share_code} />

            {/* Active Authorizations matching Image 2 Card Frame */}
            {activeAuthorizations.length > 0 && (
              <div className="bg-white border border-black rounded-2xl p-6">
                <div className="mb-4">
                  <h2 className="text-sm font-medium font-sans text-[#0A0A0A]">
                    Active Healthcare Authorizations ({activeAuthorizations.length})
                  </h2>
                  <p className="text-xs font-normal font-sans text-[#555555] mt-0.5">
                    Organizations with verified cryptographic access to your health vault
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeAuthorizations.map((auth) => (
                    <AccessRequestCard
                      key={auth.id}
                      request={auth}
                      isActiveGrant={true}
                      onRevoke={handleRevokeAuthorization}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Audit Ledger Entries matching Image 2 */}
            <div className="bg-white border border-black rounded-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-medium font-sans text-[#0A0A0A]">
                    Sovereign Ledger Activity ({auditLogs.length})
                  </h2>
                  <p className="text-xs font-normal font-sans text-[#555555] mt-0.5">
                    Complete record of all cryptographic authorizations and vault movements
                  </p>
                </div>
                <button
                  onClick={() => setTab('audit')}
                  className="text-xs text-[#0A0A0A] font-medium font-sans hover:underline"
                >
                  View Full Chain →
                </button>
              </div>

              <div className="divide-y divide-gray-100 mt-2">
                {auditLogs.slice(0, 6).map((log) => {
                  const meta = typeof log.metadata === 'string'
                    ? JSON.parse(log.metadata || '{}')
                    : (log.metadata || {});

                  return (
                    <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <span className="w-2 h-2 rounded-full bg-black shrink-0" />
                        <span className="font-mono text-[#555555]">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="font-semibold text-[#0A0A0A] font-mono">
                          {log.action}
                        </span>
                        <span className="text-[#555555] truncate max-w-sm">
                          {meta.drug_name || meta.title || meta.share_code || meta.reason || ''}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-gray-400">
                        {log.event_hash?.slice(0, 12)}...
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: HEALTH VAULT */}
        {tab === 'vault' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Health Vault
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Manage patient baseline vitals, clinical allergies, and structured health records
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Basic Medical Profile */}
              <div className="lg:col-span-4">
                <div className="bg-white border border-black rounded-2xl p-6 sticky top-24">
                  <div className="pb-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-[#0A0A0A]">Basic Medical Profile</h3>
                    <p className="text-xs text-[#555555]">Core emergency biometric baseline</p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="mt-4 space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-[#555555] mb-1">Blood Group</label>
                      <select
                        value={profileForm.blood_group || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, blood_group: e.target.value })}
                        className="w-full rounded-xl"
                      >
                        <option value="">Select blood group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-[#555555] mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={profileForm.date_of_birth ? String(profileForm.date_of_birth).split('T')[0] : ''}
                          onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                          className="w-full text-xs rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#555555] mb-1">Gender</label>
                        <select
                          value={profileForm.gender || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                          className="w-full text-xs rounded-xl"
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Non-binary">Non-binary</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-[#555555] mb-1">Height (cm)</label>
                        <input
                          type="number"
                          placeholder="178"
                          value={profileForm.height_cm || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, height_cm: e.target.value })}
                          className="w-full rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#555555] mb-1">Weight (kg)</label>
                        <input
                          type="number"
                          placeholder="74"
                          value={profileForm.weight_kg || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, weight_kg: e.target.value })}
                          className="w-full rounded-xl"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-[#555555] mb-1">Emergency Contact</label>
                      <input
                        type="text"
                        placeholder="Priya Sharma (Spouse)"
                        value={profileForm.emergency_contact || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, emergency_contact: e.target.value })}
                        className="w-full rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#555555] mb-1">Emergency Phone</label>
                      <input
                        type="tel"
                        placeholder="+1-555-0199"
                        value={profileForm.emergency_phone || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, emergency_phone: e.target.value })}
                        className="w-full rounded-xl"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="w-full mt-2 border border-[#0A0A0A] bg-black text-white py-2 rounded-xl font-medium text-xs hover:bg-[#333333] transition-colors"
                    >
                      {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Structured Records */}
              <div className="lg:col-span-8 space-y-6">
                <VaultSection
                  title="Allergies & Sensitivities"
                  subtitle="Evaluated synchronously by AI drug interaction engine"
                  icon={RiAlertLine}
                  items={vault?.allergies || []}
                  onAdd={(data) => handleAddVaultItem('allergies', data)}
                  onRemove={(idx) => handleRemoveVaultItem('allergies', idx)}
                  fields={[
                    { name: 'name', label: 'Allergen Name', required: true, placeholder: 'e.g. Penicillin' },
                    {
                      name: 'severity',
                      label: 'Severity',
                      type: 'select',
                      options: [
                        { value: 'high', label: 'High (Anaphylactic)' },
                        { value: 'medium', label: 'Medium (Hives / Rash)' },
                        { value: 'low', label: 'Low (Mild intolerance)' }
                      ]
                    },
                    { name: 'reaction', label: 'Reaction Symptoms', fullWidth: true, placeholder: 'e.g. Severe angioedema' }
                  ]}
                  renderItem={(item) => (
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-[#0A0A0A]">{item.name}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            item.severity === 'high'
                              ? 'bg-red-50 text-[#EF4444] border border-red-200'
                              : item.severity === 'medium'
                              ? 'bg-amber-50 text-[#F59E0B] border border-amber-200'
                              : 'bg-green-50 text-[#16A34A] border border-green-200'
                          }`}
                        >
                          {item.severity}
                        </span>
                      </div>
                      {item.reaction && (
                        <p className="text-xs text-[#555555] mt-0.5">Reaction: {item.reaction}</p>
                      )}
                    </div>
                  )}
                />

                <VaultSection
                  title="Current Medications"
                  subtitle="Active prescription regimen"
                  icon={RiCapsuleLine}
                  items={vault?.current_medications || []}
                  onAdd={(data) => handleAddVaultItem('medications', data)}
                  onRemove={(idx) => handleRemoveVaultItem('medications', idx)}
                  fields={[
                    { name: 'name', label: 'Medication Name', required: true, placeholder: 'e.g. Lisinopril' },
                    { name: 'dosage', label: 'Dosage', placeholder: 'e.g. 10mg' },
                    { name: 'frequency', label: 'Frequency', placeholder: 'e.g. Once daily morning' },
                    { name: 'prescribed_by', label: 'Prescribing Doctor', placeholder: 'e.g. Dr. John Smith' }
                  ]}
                  renderItem={(item) => (
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-[#0A0A0A]">{item.name}</span>
                        {item.dosage && <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{item.dosage}</span>}
                      </div>
                      <p className="text-xs text-[#555555] mt-0.5">
                        {item.frequency} {item.prescribed_by ? `• Prescribed by ${item.prescribed_by}` : ''}
                      </p>
                    </div>
                  )}
                />

                <VaultSection
                  title="Chronic Conditions"
                  subtitle="Long-term diagnosed medical conditions"
                  icon={RiHeartPulseLine}
                  items={vault?.chronic_conditions || []}
                  onAdd={(data) => handleAddVaultItem('conditions', data)}
                  onRemove={(idx) => handleRemoveVaultItem('conditions', idx)}
                  fields={[
                    { name: 'name', label: 'Condition Name', required: true, placeholder: 'e.g. Type 2 Diabetes' },
                    { name: 'since', label: 'Diagnosed Year / Since', placeholder: 'e.g. 2018' },
                    { name: 'notes', label: 'Clinical Notes', fullWidth: true, placeholder: 'e.g. Well controlled' }
                  ]}
                  renderItem={(item) => (
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-[#0A0A0A]">{item.name}</span>
                        {item.since && <span className="text-xs text-[#555555]">Since {item.since}</span>}
                      </div>
                      {item.notes && <p className="text-xs text-[#555555] mt-0.5">{item.notes}</p>}
                    </div>
                  )}
                />

                <VaultSection
                  title="Immunizations & Vaccines"
                  subtitle="Vaccination history records"
                  icon={RiShieldLine}
                  items={vault?.immunizations || []}
                  onAdd={(data) => handleAddVaultItem('immunizations', data)}
                  onRemove={(idx) => handleRemoveVaultItem('immunizations', idx)}
                  fields={[
                    { name: 'vaccine', label: 'Vaccine Name', required: true, placeholder: 'e.g. Tetanus' },
                    { name: 'date', label: 'Administration Date', type: 'date' },
                    { name: 'provider', label: 'Administering Provider', placeholder: 'e.g. City Clinic' }
                  ]}
                  renderItem={(item) => (
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-[#0A0A0A]">{item.vaccine}</span>
                        {item.date && <span className="text-xs text-[#555555]">({new Date(item.date).toLocaleDateString()})</span>}
                      </div>
                      {item.provider && <p className="text-xs text-[#555555] mt-0.5">By {item.provider}</p>}
                    </div>
                  )}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRESCRIPTION LEDGER */}
        {tab === 'prescriptions' && (
          <div className="space-y-6 animate-fadeSlideIn">
            {/* Header row: Main title Inter Bold 700, Subtitle Inter Regular 400, Button Inter Medium 500 */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold font-sans text-[#0A0A0A] tracking-tight">
                  Prescription Ledger
                </h1>
                <p className="text-xs font-normal font-sans text-[#555555] mt-1">
                  Track sovereign medication movements and cryptographic hash chain balance
                </p>
              </div>
              <button
                onClick={() => setRxSlideOverOpen(true)}
                className="flex items-center space-x-1.5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white px-4 py-2 rounded-xl text-xs font-medium font-sans transition-colors"
              >
                <RiAddLine className="text-sm" />
                <span>+ Add Prescription</span>
              </button>
            </div>

            {/* 4 Stat Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Entries"
                value={prescriptions.length}
                subtitle="Ledger prescriptions"
                variant="neutral"
              />
              <StatsCard
                title="Active Prescriptions"
                value={`+${prescriptions.filter(p => p.status === 'active').length}`}
                subtitle="Currently valid"
                variant="positive"
              />
              <StatsCard
                title="Safety Warnings"
                value={`-${prescriptions.filter(p => p.ai_warnings?.safe === false).length}`}
                subtitle="Clinical conflicts"
                variant="negative"
              />
              <StatsCard
                title="Chain Continuity"
                value="+100%"
                subtitle="Cryptographically intact"
                variant="positive"
              />
            </div>

            {/* Filters Section Card: Card heading Inter Medium 500 */}
            <div className="bg-white border border-black rounded-2xl p-6">
              <h2 className="text-sm font-medium font-sans text-[#0A0A0A] mb-3">Filters</h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <RiSearchLine className="absolute left-3.5 top-3 text-[#777777] text-sm" />
                  <input
                    type="text"
                    placeholder="Search by drug name, doctor, or diagnosis..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-black text-xs font-normal font-sans"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1.5 px-3 py-2 border border-black rounded-xl text-xs font-normal font-sans text-[#555555]">
                    <RiCalendarLine className="text-sm" />
                    <span>All dates</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest AI Warnings Banner if any */}
            {recentAiWarnings && <DrugWarningBanner warnings={recentAiWarnings} />}

            {/* Main Entries Section Card: Card heading Inter Medium 500, Subtitle Inter Regular 400 */}
            <div className="bg-white border border-black rounded-2xl p-6">
              <div className="mb-4">
                <h2 className="text-sm font-medium font-sans text-[#0A0A0A]">
                  Prescription Ledger Entries ({filteredPrescriptions.length})
                </h2>
                <p className="text-xs font-normal font-sans text-[#555555] mt-0.5">
                  Complete cryptographically chained record of all prescriptions
                </p>
              </div>

              <div className="space-y-4">
                {filteredPrescriptions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#555555]">
                    No prescription entries matching filter. Click "+ Add Prescription" to sign a new record.
                  </div>
                ) : (
                  filteredPrescriptions.map((rx) => (
                    <PrescriptionCard key={rx.id} rx={rx} onRefresh={loadData} />
                  ))
                )}
              </div>
            </div>

            {/* Slide-Over Panel: Add New Prescription */}
            {rxSlideOverOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-end">
                <div className="bg-white w-full max-w-lg h-full p-6 overflow-y-auto shadow-2xl flex flex-col justify-between animate-fadeSlideIn">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-black">
                      <div>
                        <h3 className="text-base font-semibold text-[#0A0A0A]">
                          Add New Prescription
                        </h3>
                        <p className="text-xs text-[#555555]">
                          Sign prescription onto sovereign ledger with RSA-PSS
                        </p>
                      </div>
                      <button
                        onClick={() => setRxSlideOverOpen(false)}
                        className="text-[#555555] hover:text-[#0A0A0A]"
                      >
                        <RiCloseLine className="text-2xl" />
                      </button>
                    </div>

                    <form id="rx-form" onSubmit={handleCreatePrescription} className="py-4 space-y-3 text-xs">
                      <div>
                        <label className="block font-medium text-[#0A0A0A] mb-1">
                          Drug Name <span className="text-[#EF4444]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Amoxicillin, Metformin, Warfarin"
                          value={newRx.drug_name}
                          onChange={(e) => setNewRx({ ...newRx, drug_name: e.target.value })}
                          className="w-full rounded-xl"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-medium text-[#0A0A0A] mb-1">
                            Dosage <span className="text-[#EF4444]">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 500mg"
                            value={newRx.dosage}
                            onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })}
                            className="w-full rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[#0A0A0A] mb-1">
                            Frequency <span className="text-[#EF4444]">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Twice daily"
                            value={newRx.frequency}
                            onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })}
                            className="w-full rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-medium text-[#0A0A0A] mb-1">
                            Duration
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 7 days"
                            value={newRx.duration}
                            onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })}
                            className="w-full rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[#0A0A0A] mb-1">
                            Diagnosis
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Bacterial Sinusitis"
                            value={newRx.diagnosis}
                            onChange={(e) => setNewRx({ ...newRx, diagnosis: e.target.value })}
                            className="w-full rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-medium text-[#0A0A0A] mb-1">
                            Prescribing Doctor <span className="text-[#EF4444]">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Dr. Sarah Connor"
                            value={newRx.doctor_name}
                            onChange={(e) => setNewRx({ ...newRx, doctor_name: e.target.value })}
                            className="w-full rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[#0A0A0A] mb-1">
                            Doctor Registration No
                          </label>
                          <input
                            type="text"
                            placeholder="MED-89421"
                            value={newRx.doctor_reg}
                            onChange={(e) => setNewRx({ ...newRx, doctor_reg: e.target.value })}
                            className="w-full rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-medium text-[#0A0A0A] mb-1">
                            Issue Date <span className="text-[#EF4444]">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={newRx.issued_date}
                            onChange={(e) => setNewRx({ ...newRx, issued_date: e.target.value })}
                            className="w-full rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[#0A0A0A] mb-1">
                            Expiry Date
                          </label>
                          <input
                            type="date"
                            value={newRx.expiry_date}
                            onChange={(e) => setNewRx({ ...newRx, expiry_date: e.target.value })}
                            className="w-full rounded-xl"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-medium text-[#0A0A0A] mb-1">
                          Clinical Notes
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Instructions..."
                          value={newRx.notes}
                          onChange={(e) => setNewRx({ ...newRx, notes: e.target.value })}
                          className="w-full rounded-xl"
                        />
                      </div>

                      {/* Cryptographic PIN Section */}
                      <div className="pt-4 border-t border-gray-100 flex flex-col items-center bg-gray-50/70 p-4 rounded-xl">
                        <label className="block text-xs font-semibold text-[#0A0A0A] text-center mb-1">
                          Cryptographic Signature Authorization
                        </label>
                        <p className="text-[11px] text-[#555555] text-center mb-3">
                          Enter your 4-digit PIN to sign this prescription cryptographically with your RSA private key.
                        </p>
                        <PinInput
                          value={newRx.pin}
                          onChange={(p) => {
                            setNewRx({ ...newRx, pin: p });
                            if (rxPinError) setRxPinError(false);
                          }}
                          error={rxPinError}
                        />
                      </div>
                    </form>
                  </div>

                  <div className="pt-4 border-t border-black flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setRxSlideOverOpen(false)}
                      className="px-4 py-2 border border-black rounded-xl text-xs font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="rx-form"
                      disabled={rxSubmitting || newRx.pin.length !== 4}
                      className="px-4 py-2 bg-black text-white rounded-xl text-xs font-medium hover:bg-[#333333] disabled:opacity-50"
                    >
                      {rxSubmitting ? 'Signing Prescription...' : 'Sign & Secure Prescription'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MEDICAL DOCUMENTS */}
        {tab === 'documents' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Medical Documents
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Securely stored lab reports and scans with SHA-256 integrity verification
                </p>
              </div>
              <button
                onClick={() => setUploadDocModalOpen(true)}
                className="flex items-center space-x-1.5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <RiUploadCloudLine className="text-sm" />
                <span>+ Upload Document</span>
              </button>
            </div>

            {/* Document Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.length === 0 ? (
                <div className="col-span-full bg-white border border-black rounded-2xl p-12 text-center text-xs text-[#555555]">
                  No documents secured yet. Click "+ Upload Document" to add your first file.
                </div>
              ) : (
                documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    onDeleted={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))}
                  />
                ))
              )}
            </div>

            {/* Upload Document Modal — full screen z-[9999] */}
            {uploadDocModalOpen && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div className="bg-white border border-black rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fadeSlideIn">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-black">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#0A0A0A] rounded-lg flex items-center justify-center">
                        <RiUploadCloudLine className="text-white text-base" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#0A0A0A]">Upload Medical Document</h3>
                        <p className="text-[10px] text-[#555555] font-mono">SHA-256 integrity hash computed on upload</p>
                      </div>
                    </div>
                    <button onClick={() => setUploadDocModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#555555]">
                      <RiCloseLine className="text-lg" />
                    </button>
                  </div>

                  <form onSubmit={handleUploadDocument} className="px-6 py-5 space-y-4 text-xs">
                    <div>
                      <label className="block font-medium text-[#0A0A0A] mb-1">Document Title <span className="text-[#EF4444]">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Complete Blood Count Report"
                        value={newDoc.title}
                        onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#0A0A0A] mb-1">Document Type <span className="text-[#EF4444]">*</span></label>
                      <select
                        value={newDoc.document_type}
                        onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })}
                        className="w-full"
                      >
                        <option value="lab_report">Lab Report</option>
                        <option value="xray">X-Ray</option>
                        <option value="scan">Scan (MRI / CT)</option>
                        <option value="discharge_summary">Discharge Summary</option>
                        <option value="insurance_doc">Insurance Document</option>
                        <option value="other">Other Medical Record</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[#0A0A0A] mb-1">Description</label>
                      <input
                        type="text"
                        placeholder="Optional notes about this document"
                        value={newDoc.description}
                        onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#0A0A0A] mb-1">File (.pdf, .jpg, .png — Max 10MB) <span className="text-[#EF4444]">*</span></label>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        required
                        onChange={handleFileChange}
                        className="w-full p-2 border border-dashed border-black rounded-xl cursor-pointer hover:bg-gray-50 bg-gray-50/50"
                      />
                    </div>

                    {docFilePreview && (
                      <div className="p-2 border border-black rounded-xl bg-gray-50 flex items-center justify-center max-h-40 overflow-hidden">
                        <img src={docFilePreview} alt="Preview" className="max-h-36 object-contain rounded-lg" />
                      </div>
                    )}

                    {newDoc.file_name && (
                      <div className="flex items-center space-x-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                        <RiFolderLine className="text-[#555555] text-sm shrink-0" />
                        <span className="text-[#0A0A0A] font-medium truncate">{newDoc.file_name}</span>
                      </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setUploadDocModalOpen(false)}
                        className="px-4 py-2 border border-black rounded-xl text-xs hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={docSubmitting || !newDoc.file_data}
                        className="px-5 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-[#333333] disabled:opacity-40 transition-colors flex items-center space-x-1.5"
                      >
                        <RiUploadCloudLine className="text-sm" />
                        <span>{docSubmitting ? 'Uploading...' : 'Upload & Compute Hash'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 5: ACCESS REQUESTS */}

        {tab === 'requests' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Access Authorization Ledger
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Enforces: Identity ≠ Authorization ≠ Access. Only your 4-digit PIN can grant scoped data release.
                </p>
              </div>
            </div>

            {/* Pending Requests Section */}
            <div className="bg-white border border-black rounded-2xl p-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-[#0A0A0A]">
                  Pending Access Requests ({pendingRequests.length})
                </h2>
                <p className="text-xs text-[#555555]">
                  Awaiting your sovereign RSA signature
                </p>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#555555]">
                  No pending access requests.
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((req) => (
                    <AccessRequestCard
                      key={req.id}
                      request={req}
                      onApprove={handleApproveRequest}
                      onReject={handleRejectRequest}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Active Authorizations */}
            <div className="bg-white border border-black rounded-2xl p-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-[#0A0A0A]">
                  Active Grants ({activeAuthorizations.length})
                </h2>
                <p className="text-xs text-[#555555]">
                  Currently valid grants. Revocation immediately terminates access.
                </p>
              </div>

              {activeAuthorizations.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#555555]">
                  No active data grants currently issued.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeAuthorizations.map((req) => (
                    <AccessRequestCard
                      key={req.id}
                      request={req}
                      isActiveGrant={true}
                      onRevoke={handleRevokeAuthorization}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* History Table */}
            <div className="bg-white border border-black rounded-2xl p-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-[#0A0A0A]">
                  Authorization History
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-200 text-[#555555] font-mono uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Organization</th>
                      <th className="py-2.5 px-3">Purpose</th>
                      <th className="py-2.5 px-3">Categories</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Expires At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requestHistory.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="py-3 px-3 font-semibold text-[#0A0A0A]">{req.org_name}</td>
                        <td className="py-3 px-3 text-[#555555] capitalize">{req.purpose}</td>
                        <td className="py-3 px-3 text-[#555555]">{req.data_categories?.join(', ')}</td>
                        <td className="py-3 px-3 font-mono text-[11px] uppercase">
                          <span className="px-2 py-0.5 rounded-full border border-gray-200">{req.status}</span>
                        </td>
                        <td className="py-3 px-3 text-[#555555] font-mono">
                          {req.expires_at ? new Date(req.expires_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT TRAIL */}
        {tab === 'audit' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Cryptographic Audit Trail
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  SHA-256 hash-chained immutable ledger of all sovereign transactions
                </p>
              </div>
            </div>

            <AuditTable logs={auditLogs} />
          </div>
        )}

        {/* TAB 7: PROFILE / SETTINGS */}
        {tab === 'profile' && (
          <div className="space-y-6 max-w-2xl animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Sovereign Settings
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Keypair management, sovereign share code, and data portability
                </p>
              </div>
            </div>

            <div className="bg-white border border-black rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[#0A0A0A]">Identity Credentials</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#555555] block">Full Name</span>
                  <span className="font-semibold text-[#0A0A0A] text-sm">{user.name}</span>
                </div>
                <div>
                  <span className="text-[#555555] block">Email</span>
                  <span className="font-semibold text-[#0A0A0A] text-sm">{user.email}</span>
                </div>
              </div>
              <ShareCodeDisplay shareCode={user.share_code} />
            </div>

            <div className="bg-white border border-black rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-[#0A0A0A] mb-1">Change Sovereign PIN</h3>
              <p className="text-xs text-[#555555] mb-4">Re-encrypts your RSA private key with a new PIN</p>
              <form onSubmit={handleChangePinSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col items-center">
                    <label className="text-xs text-[#555555] mb-2">Current PIN</label>
                    <PinInput
                      value={changePinData.currentPin}
                      onChange={(p) => setChangePinData({ ...changePinData, currentPin: p })}
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <label className="text-xs text-[#555555] mb-2">New PIN</label>
                    <PinInput
                      value={changePinData.newPin}
                      onChange={(p) => setChangePinData({ ...changePinData, newPin: p })}
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <label className="text-xs text-[#555555] mb-2">Confirm PIN</label>
                    <PinInput
                      value={changePinData.confirmPin}
                      onChange={(p) => setChangePinData({ ...changePinData, confirmPin: p })}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={
                      changePinLoading ||
                      changePinData.currentPin.length !== 4 ||
                      changePinData.newPin.length !== 4 ||
                      changePinData.confirmPin.length !== 4
                    }
                    className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-xl hover:bg-[#333333] transition-colors disabled:opacity-50"
                  >
                    {changePinLoading ? 'Updating PIN...' : 'Update & Re-encrypt Keys'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white border border-black rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#0A0A0A]">Export All Sovereign Data</h3>
                <p className="text-xs text-[#555555]">Download entire vault, prescriptions, and cryptographic proofs as JSON</p>
              </div>
              <button
                onClick={handleDownloadAllData}
                className="flex items-center space-x-1.5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-black hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <RiDownloadLine className="text-sm" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <CryptoProcessPopup
        isOpen={cryptoPopupOpen}
        onClose={() => setCryptoPopupOpen(false)}
        approvalData={approvalResult}
      />
    </div>
  );
}
