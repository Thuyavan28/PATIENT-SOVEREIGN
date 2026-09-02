import React, { useState } from 'react';
import {
  RiShieldCheckLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiGitCommitLine,
  RiLinkM
} from 'react-icons/ri';
import api from '../lib/api';
import { toast } from '../lib/toast';

export default function AuditTable({ logs = [], isAdmin = false }) {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const actionStyles = {
    patient_registered: 'bg-blue-50 text-blue-700 border-blue-200',
    org_registered: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    vault_updated: 'bg-gray-100 text-gray-700 border-gray-300',
    prescription_created: 'bg-blue-50 text-[#3B82F6] border-blue-200',
    document_uploaded: 'bg-gray-100 text-[#555555] border-gray-300',
    document_deleted: 'bg-gray-100 text-[#555555] border-gray-300',
    share_code_lookup: 'bg-purple-50 text-purple-700 border-purple-200',
    access_requested: 'bg-amber-50 text-[#F59E0B] border-amber-200',
    access_approved: 'bg-green-50 text-[#16A34A] border-green-200',
    access_rejected: 'bg-red-50 text-[#EF4444] border-red-200',
    access_revoked: 'bg-red-50 text-[#EF4444] border-red-200',
    data_accessed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    fraud_flagged: 'bg-amber-50 text-[#F59E0B] border-amber-200',
    tamper_detected: 'bg-red-100 text-[#EF4444] border-red-300 font-bold animate-pulse',
    org_verified: 'bg-green-50 text-[#16A34A] border-green-200'
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const endpoint = isAdmin ? '/admin/audit/verify' : '/audit/verify';
      const res = await api.get(endpoint);
      setVerificationResult(res.data);
      if (res.data.valid) {
        toast.success(`Audit hash chain valid across all ${res.data.total_events} cryptographic records.`);
      } else {
        toast.error('Audit chain broken or tampered!');
      }
    } catch (err) {
      toast.error('Failed to verify audit chain');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Header and Chain Verification CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-black rounded-2xl p-6">
        <div>
          <h3 className="text-sm font-medium font-sans text-[#0A0A0A]">
            Cryptographic Audit Trail (Hash Chain)
          </h3>
          <p className="text-xs font-normal font-sans text-[#555555] mt-1">
            Every sovereign transaction is hashed and linked to its predecessor: SHA-256(prev_hash + event)
          </p>
        </div>
        <button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="flex items-center space-x-1.5 text-xs font-medium font-sans border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-black hover:text-white px-4 py-2 rounded-xl transition-colors shrink-0 disabled:opacity-50"
        >
          <RiShieldCheckLine className="text-sm" />
          <span>{verifying ? 'Recalculating Chain...' : 'Verify Chain Integrity'}</span>
        </button>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between animate-fadeSlideIn font-sans ${
            verificationResult.valid
              ? 'bg-green-50/80 border-[#16A34A] text-[#16A34A]'
              : 'bg-red-50 border-[#EF4444] text-[#EF4444]'
          }`}
        >
          <div className="flex items-center space-x-2">
            {verificationResult.valid ? (
              <RiCheckLine className="text-lg text-[#16A34A]" />
            ) : (
              <RiErrorWarningLine className="text-lg text-[#EF4444]" />
            )}
            <span className="font-medium font-sans">
              {verificationResult.valid
                ? `Cryptographic Hash Chain Valid: All ${verificationResult.total_events} events verified intact from genesis block.`
                : `Chain Integrity Compromised at ID: ${verificationResult.broken_at_id}. Possible database tampering detected!`}
            </span>
          </div>
          <button
            onClick={() => setVerificationResult(null)}
            className="text-[#555555] hover:text-[#0A0A0A] font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white border border-black rounded-2xl overflow-hidden shadow-none p-6">
        <div className="mb-4">
          <h4 className="text-sm font-medium font-sans text-[#0A0A0A]">
            Audit Ledger Entries ({logs.length})
          </h4>
          <p className="text-xs font-normal font-sans text-[#555555] mt-0.5">
            Immutable chain-of-custody for all medical data requests and cryptographic grants
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 text-[#555555] font-sans font-medium">
              <tr>
                <th className="py-3 px-4 font-medium font-sans">Chain</th>
                <th className="py-3 px-4 font-medium font-sans">Timestamp</th>
                <th className="py-3 px-4 font-medium font-sans">Action</th>
                <th className="py-3 px-4 font-medium font-sans">Details & Target</th>
                <th className="py-3 px-4 font-medium font-sans">Previous Hash</th>
                <th className="py-3 px-4 font-medium font-sans">Event Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#555555]">
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => {
                  const meta = typeof log.metadata === 'string'
                    ? JSON.parse(log.metadata || '{}')
                    : (log.metadata || {});

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Visual chain icon */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <RiLinkM className="text-[#555555] text-sm" />
                          {index < logs.length - 1 && (
                            <div className="w-[1px] h-3 bg-[#D0D0D0] mt-1" />
                          )}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-[#555555] whitespace-nowrap font-mono">
                        {new Date(log.created_at).toLocaleString('en-US', {
                          dateStyle: 'short',
                          timeStyle: 'medium'
                        })}
                      </td>

                      {/* Action badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-mono border ${
                            actionStyles[log.action] || 'bg-gray-100 text-gray-700 border-gray-300'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Details */}
                      <td className="py-3 px-4 max-w-xs truncate text-[#0A0A0A]">
                        {meta.drug_name && <span className="font-semibold mr-1">Rx: {meta.drug_name}</span>}
                        {meta.title && <span className="font-semibold mr-1">Doc: {meta.title}</span>}
                        {meta.share_code && <span className="font-mono bg-gray-100 px-1 py-0.5 rounded mr-1">{meta.share_code}</span>}
                        {meta.rule && <span className="font-semibold text-[#F59E0B] mr-1">Rule: {meta.rule}</span>}
                        {meta.reason && <span className="text-[#555555] mr-1">"{meta.reason}"</span>}
                        {meta.categories && (
                          <span className="text-[11px] text-[#555555]">
                            [{meta.categories.join(', ')}]
                          </span>
                        )}
                        {!meta.drug_name && !meta.title && !meta.share_code && !meta.rule && !meta.categories && (
                          <span className="text-gray-400 font-mono text-[11px]">
                            {JSON.stringify(meta).slice(0, 45)}
                          </span>
                        )}
                      </td>

                      {/* Previous Hash */}
                      <td className="py-3 px-4 font-mono text-[11px] text-[#555555] select-all whitespace-nowrap">
                        {log.prev_hash === '0' ? (
                          <span className="text-gray-400 font-sans italic">Genesis (0)</span>
                        ) : (
                          <span>{log.prev_hash?.slice(0, 10)}...</span>
                        )}
                      </td>

                      {/* Event Hash */}
                      <td className="py-3 px-4 font-mono text-[11px] font-semibold text-[#0A0A0A] select-all whitespace-nowrap">
                        <span>{log.event_hash?.slice(0, 12)}...</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
