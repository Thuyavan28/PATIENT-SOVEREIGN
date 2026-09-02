import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { toast } from '../lib/toast';

// React Icons (ri package only)
import {
  RiDashboardLine,
  RiBuildingLine,
  RiFileListLine,
  RiAlertLine,
  RiBarChartLine,
  RiCheckLine,
  RiCloseLine,
  RiShieldCheckLine,
  RiUserLine,
  RiHealthBookLine,
  RiFolderLine,
  RiRefreshLine
} from 'react-icons/ri';

import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import StatsCard from '../components/StatsCard';
import AuditTable from '../components/AuditTable';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  const [stats, setStats] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [fraudFlags, setFraudFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for Fraud Flags tab
  const [severityFilter, setSeverityFilter] = useState('all');
  const [ruleFilter, setRuleFilter] = useState('all');

  const loadAdminData = async () => {
    try {
      const [statsRes, orgsRes, auditRes, flagsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/orgs'),
        api.get('/admin/audit?limit=50'),
        api.get('/admin/fraud-flags')
      ]);

      setStats(statsRes.data);
      setOrgs(orgsRes.data);
      setAuditLogs(auditRes.data?.logs || []);
      setFraudFlags(flagsRes.data || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleOrgVerify = async (orgId) => {
    try {
      const res = await api.post(`/admin/orgs/${orgId}/verify`);
      toast.success(res.data.message);
      loadAdminData();
    } catch (err) {
      toast.error('Failed to update organization status');
    }
  };

  const filteredFlags = fraudFlags.filter((f) => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (ruleFilter !== 'all' && f.rule_triggered !== ruleFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Sidebar currentTab={tab} setTab={setTab} />
      <TopBar breadcrumb={tab} />

      <main className="ml-[240px] p-8 max-w-[1200px] space-y-6">

        {/* TAB 1: OVERVIEW */}
        {tab === 'overview' && stats && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  System Administration
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Manage organization verifications, monitor tamper-evident audit ledger, and fraud anomalies
                </p>
              </div>
              <button
                onClick={loadAdminData}
                className="flex items-center space-x-1.5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <RiRefreshLine className="text-sm" />
                <span>Refresh Metrics</span>
              </button>
            </div>

            {/* 6 Stat Cards Grid matching Image 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatsCard
                title="Total Sovereign Patients"
                value={stats.total_patients}
                subtitle="Sovereign RSA key owners"
                variant="neutral"
              />
              <StatsCard
                title="Registered Organizations"
                value={`+${stats.total_orgs}`}
                subtitle="Hospitals, pharmacies, labs"
                variant="positive"
              />
              <StatsCard
                title="Prescriptions (24h)"
                value={`+${stats.prescriptions_today}`}
                subtitle="Cryptographically chained"
                variant="positive"
              />
              <StatsCard
                title="Active Data Grants"
                value={`+${stats.active_authorizations}`}
                subtitle="Zero-trust access grants"
                variant="positive"
              />
              <StatsCard
                title="Medical Documents"
                value={stats.documents_total}
                subtitle="SHA-256 hashed files"
                variant="neutral"
              />
              <StatsCard
                title="Fraud Flags (7d)"
                value={`-${stats.flags_this_week}`}
                subtitle="Synchronous rule events"
                variant={stats.flags_this_week > 0 ? 'negative' : 'neutral'}
              />
            </div>

            {/* Organizations Pending Verification Alert */}
            {orgs.filter((o) => !o.org_verified).length > 0 && (
              <div className="bg-amber-50 border border-[#F59E0B] rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <RiAlertLine className="text-[#F59E0B] text-xl" />
                    <div>
                      <h4 className="text-sm font-semibold text-[#0A0A0A]">
                        {orgs.filter((o) => !o.org_verified).length} Organization(s) Awaiting Admin Verification
                      </h4>
                      <p className="text-xs text-[#555555]">
                        Unverified orgs can make requests, but requests are flagged automatically until verified.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTab('orgs')}
                    className="text-xs font-semibold bg-[#0A0A0A] text-white px-4 py-2 rounded-xl"
                  >
                    Review Organizations
                  </button>
                </div>
              </div>
            )}

            {/* Recent Audit Ledger Entries */}
            <div className="bg-white border border-black rounded-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-semibold text-[#0A0A0A]">
                    System-Wide Cryptographic Audit Ledger
                  </h2>
                  <p className="text-xs text-[#555555]">
                    Tamper-evident SHA-256 event stream across all actors
                  </p>
                </div>
                <button
                  onClick={() => setTab('audit')}
                  className="text-xs text-[#0A0A0A] font-semibold hover:underline"
                >
                  View Full Audit Log →
                </button>
              </div>

              <div className="divide-y divide-gray-100 mt-2">
                {auditLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-[#555555]">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-semibold text-[#0A0A0A] font-mono">
                        {log.action}
                      </span>
                      <span className="text-[#555555]">
                        by {log.actor_name || log.actor_role}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-gray-400">
                      {log.event_hash?.slice(0, 14)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ORGANIZATIONS */}
        {tab === 'orgs' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Healthcare Organizations
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Manage trust classifications and cryptographic verification for healthcare entities
                </p>
              </div>
              <button
                onClick={loadAdminData}
                className="flex items-center space-x-1.5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-black hover:text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <RiRefreshLine className="text-sm" />
                <span>Refresh List</span>
              </button>
            </div>

            <div className="bg-white border border-black rounded-2xl p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-200 text-[#555555] font-mono uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Organization Name</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Requests</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orgs.map((org) => (
                      <tr key={org.id} className="hover:bg-gray-50">
                        <td className="py-3 px-3 font-semibold text-[#0A0A0A]">{org.name}</td>
                        <td className="py-3 px-3 font-mono capitalize text-[#555555]">{org.org_type || 'Healthcare'}</td>
                        <td className="py-3 px-3 text-[#555555]">{org.email}</td>
                        <td className="py-3 px-3 font-mono">{org.total_requests || 0}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              org.org_verified
                                ? 'bg-green-50 text-[#16A34A] border-green-200'
                                : 'bg-amber-50 text-[#F59E0B] border-amber-200'
                            }`}
                          >
                            {org.org_verified ? 'Verified' : 'Pending Verification'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleToggleOrgVerify(org.id)}
                            className={`px-3.5 py-1.5 text-xs rounded-xl font-semibold transition-colors ${
                              org.org_verified
                                ? 'border border-black text-[#555555] hover:bg-gray-100'
                                : 'bg-black text-white hover:bg-[#333333]'
                            }`}
                          >
                            {org.org_verified ? 'Revoke Verification' : 'Verify Organization'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FULL AUDIT LOG */}
        {tab === 'audit' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Full System Audit Log
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Cryptographically recalculate hash chains from genesis block across all actors
                </p>
              </div>
            </div>

            <AuditTable logs={auditLogs} isAdmin={true} />
          </div>
        )}

        {/* TAB 4: FRAUD FLAGS */}
        {tab === 'fraud' && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Fraud Detection Flags ({filteredFlags.length})
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Real-time detection of prescription shopping, duplicate requests, and expired prescription access
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex items-center space-x-2 text-xs">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="py-1.5 px-3 rounded-xl border border-black text-xs"
                >
                  <option value="all">All Severities</option>
                  <option value="high">High Severity</option>
                  <option value="medium">Medium Severity</option>
                  <option value="low">Low Severity</option>
                </select>

                <select
                  value={ruleFilter}
                  onChange={(e) => setRuleFilter(e.target.value)}
                  className="py-1.5 px-3 rounded-xl border border-black text-xs"
                >
                  <option value="all">All Rules</option>
                  <option value="MULTI_ORG_ATTEMPT">MULTI_ORG_ATTEMPT</option>
                  <option value="DUPLICATE_REQUEST">DUPLICATE_REQUEST</option>
                  <option value="EXPIRED_PRESCRIPTION">EXPIRED_PRESCRIPTION</option>
                  <option value="UNVERIFIED_ORG">UNVERIFIED_ORG</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {filteredFlags.map((flag) => {
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
                            {flag.severity}
                          </span>
                        </div>
                        <p className="text-xs text-[#555555] mt-1">
                          {details.message || 'Suspicious access pattern'}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-[#555555]">
                        {new Date(flag.flagged_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-gray-50 p-3 rounded-xl">
                      <div>
                        <span className="text-[#555555] block text-[11px]">Patient:</span>
                        <span className="font-medium text-[#0A0A0A]">{flag.patient_name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#555555] block text-[11px]">Prescription:</span>
                        <span className="font-medium text-[#0A0A0A]">{flag.drug_name ? `${flag.drug_name} (${flag.dosage})` : '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#555555] block text-[11px]">Purpose:</span>
                        <span className="font-medium text-[#0A0A0A]">{flag.purpose || '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: STATS */}
        {tab === 'stats' && stats && (
          <div className="space-y-6 animate-fadeSlideIn">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">
                  Security Analytics
                </h1>
                <p className="text-xs text-[#555555] mt-1">
                  Cryptographic verification benchmarks and security telemetry
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-black rounded-2xl p-6 space-y-3">
                <h3 className="text-sm font-semibold text-[#0A0A0A]">Architecture Principles</h3>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                  <span className="font-bold text-[#0A0A0A] block">Identity ≠ Authorization ≠ Access</span>
                  <p className="text-[#555555]">
                    Share codes only resolve identity metadata. Zero medical vault data is ever exposed without an unexpired, RSA-PSS signature-verified grant.
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                  <span className="font-bold text-[#0A0A0A] block">Triple-Key AI Failover</span>
                  <p className="text-[#555555]">
                    OpenRouter mistralai engine with 3 automated failover API keys to prevent 429 rate-limits, backed by deterministic clinical pharmacology rules.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-black rounded-2xl p-6 space-y-2 text-xs">
                <h3 className="text-sm font-semibold text-[#0A0A0A] mb-3">Live Telemetry</h3>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-[#555555]">Total Patients</span>
                  <span className="font-bold font-mono text-[#0A0A0A]">{stats.total_patients}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-[#555555]">Total Organizations</span>
                  <span className="font-bold font-mono text-[#0A0A0A]">{stats.total_orgs}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-[#555555]">Active Grants</span>
                  <span className="font-bold font-mono text-[#16A34A]">{stats.active_authorizations}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[#555555]">Fraud Flags (7d)</span>
                  <span className="font-bold font-mono text-[#EF4444]">{stats.flags_this_week}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
