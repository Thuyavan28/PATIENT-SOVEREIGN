import React, { useState } from 'react';
import {
  RiBuildingLine,
  RiTimeLine,
  RiCheckLine,
  RiCloseLine,
  RiShieldCheckLine,
  RiAlertLine,
  RiShieldFlashLine
} from 'react-icons/ri';
import CryptoAuthOverlay from './CryptoAuthOverlay';

export default function AccessRequestCard({
  request,
  onApprove,
  onReject,
  onRevoke,
  isActiveGrant = false
}) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokePinModalOpen, setRevokePinModalOpen] = useState(false);
  const [revokePin, setRevokePin] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);

  const categoryLabels = {
    allergies: 'Allergies',
    current_medications: 'Current Medications',
    prescriptions: 'Prescriptions',
    lab_reports: 'Lab Reports',
    documents: 'Medical Documents',
    diagnoses: 'Diagnoses',
    chronic_conditions: 'Chronic Conditions',
    immunizations: 'Immunizations',
    surgical_history: 'Surgical History',
    family_history: 'Family History'
  };

  const purposeLabels = {
    treatment: 'Treatment',
    dispense_medicine: 'Dispense Medicine',
    insurance_claim: 'Insurance Claim',
    diagnosis_review: 'Diagnosis Review',
    lab_test: 'Lab Test'
  };

  // Approval goes through the new full-screen overlay
  const handleApproveClick = () => setOverlayOpen(true);

  // The overlay calls this when patient confirms PIN
  const handleConfirmApprove = async (requestId, pin) => {
    return await onApprove(requestId, pin);
  };

  const handleConfirmRevoke = async () => {
    if (!revokePin || revokePin.length !== 4) return;
    setRevokeLoading(true);
    try {
      await onRevoke(request.id, revokeReason, revokePin);
      setRevokeModalOpen(false);
      setRevokePinModalOpen(false);
      setRevokeReason('');
      setRevokePin('');
    } catch (err) {
      // error toasted upstream
    } finally {
      setRevokeLoading(false);
    }
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return '—';
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining`;
  };

  return (
    <>
      <div className="bg-white border border-black rounded-xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-gray-50 border border-black rounded-lg text-[#0A0A0A]">
              <RiBuildingLine className="text-xl" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-[#0A0A0A]">{request.org_name}</h3>
                <span className="text-[10px] font-mono text-[#555555] bg-gray-100 border border-gray-200 px-2 py-0.5 rounded capitalize">
                  {request.org_type || 'Healthcare'}
                </span>
                {request.org_verified === false && (
                  <span className="text-[10px] font-medium bg-amber-100 text-[#F59E0B] border border-amber-200 px-1.5 py-0.5 rounded">
                    Unverified
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 mt-1 text-xs text-[#555555]">
                <span className="font-medium text-[#0A0A0A]">
                  {purposeLabels[request.purpose] || request.purpose}
                </span>
                <span>·</span>
                <span>{request.duration_hours}h grant</span>
                <span>·</span>
                <span>{new Date(request.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {isActiveGrant ? (
            <div className="flex items-center space-x-1.5 text-xs font-mono font-medium text-[#16A34A] bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
              <RiTimeLine className="text-sm" />
              <span>{getTimeRemaining(request.expires_at)}</span>
            </div>
          ) : (
            <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${
              request.status === 'pending'
                ? 'bg-amber-50 text-[#F59E0B] border-amber-200'
                : request.status === 'approved'
                ? 'bg-green-50 text-[#16A34A] border-green-200'
                : 'bg-gray-100 text-[#555555] border-gray-200'
            }`}>
              {request.status}
            </span>
          )}
        </div>

        {/* Scope */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#555555] block mb-1.5">
            {isActiveGrant ? 'Authorized Scope:' : 'Requested Scope:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(request.data_categories || []).map(cat => (
              <span key={cat} className="text-[10px] bg-gray-50 border border-black text-[#0A0A0A] px-2 py-0.5 rounded font-mono">
                {categoryLabels[cat] || cat}
              </span>
            ))}
          </div>
        </div>

        {request.purpose_notes && (
          <p className="text-xs text-[#555555] bg-gray-50 p-2.5 rounded-lg border border-dashed border-gray-300">
            Clinical note: {request.purpose_notes}
          </p>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          {request.status === 'pending' ? (
            <div className="flex items-center space-x-2 w-full justify-end">
              <button
                onClick={() => onReject(request.id)}
                className="flex items-center space-x-1 text-xs border border-black text-[#555555] hover:text-[#0A0A0A] hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"
              >
                <RiCloseLine className="text-base" />
                <span>Reject</span>
              </button>
              <button
                onClick={handleApproveClick}
                className="flex items-center space-x-2 text-xs font-bold bg-black text-white px-4 py-2 rounded-lg hover:bg-[#222222] transition-colors"
              >
                <RiShieldFlashLine className="text-sm" />
                <span>Authorize &amp; Sign</span>
              </button>
            </div>
          ) : isActiveGrant ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-1.5 text-xs text-[#16A34A]">
                <RiShieldCheckLine className="text-sm" />
                <span className="font-medium">RSA grant active</span>
              </div>
              <button
                onClick={() => setRevokeModalOpen(true)}
                className="flex items-center space-x-1 text-xs font-medium bg-[#EF4444] text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
              >
                <span>Revoke Access</span>
              </button>
            </div>
          ) : (
            <div className="text-xs text-[#555555] font-mono">
              {request.status === 'revoked' && `Revoked: ${request.revoke_reason || 'By patient'}`}
              {request.status === 'rejected' && 'Rejected by patient'}
              {request.status === 'approved' && `Expired: ${new Date(request.expires_at).toLocaleString()}`}
            </div>
          )}
        </div>
      </div>

      {/* Full-screen RSA Authorization Overlay */}
      <CryptoAuthOverlay
        isOpen={overlayOpen}
        request={request}
        onApprove={handleConfirmApprove}
        onClose={() => setOverlayOpen(false)}
      />

      {/* Revoke Modal */}
      {revokeModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-black rounded-2xl shadow-2xl max-w-md w-full p-7 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-bold text-[#0A0A0A]">Revoke Access Authorization</h3>
                <p className="text-xs text-[#555555] mt-0.5">This immediately cuts off {request.org_name}'s data access</p>
              </div>
              <button onClick={() => setRevokeModalOpen(false)} className="text-[#555555] hover:text-[#0A0A0A]">
                <RiCloseLine className="text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#0A0A0A] mb-1">Reason for Revocation</label>
                <input
                  type="text"
                  placeholder="e.g. Treatment completed / Privacy concern"
                  value={revokeReason}
                  onChange={e => setRevokeReason(e.target.value)}
                  className="w-full text-xs border border-black rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#0A0A0A] mb-1">Confirm with your 4-digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={revokePin}
                  onChange={e => setRevokePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full text-xs border border-black rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-black text-center tracking-[0.5em] text-xl font-bold"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => setRevokeModalOpen(false)}
                className="flex-1 py-2 text-xs border border-black rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={revokeLoading || revokePin.length !== 4}
                className="flex-1 py-2 text-xs font-bold bg-[#EF4444] text-white rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {revokeLoading ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
