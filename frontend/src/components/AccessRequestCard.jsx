import React, { useState } from 'react';
import {
  RiBuildingLine,
  RiTimeLine,
  RiCheckLine,
  RiCloseLine,
  RiShieldCheckLine,
  RiAlertLine
} from 'react-icons/ri';
import ConfirmModal from './ConfirmModal';

export default function AccessRequestCard({
  request,
  onApprove,
  onReject,
  onRevoke,
  isActiveGrant = false
}) {
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

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

  const handleApproveClick = () => {
    setPinModalOpen(true);
  };

  const handleConfirmPinApprove = async (pin) => {
    await onApprove(request.id, pin);
  };

  const handleConfirmRevoke = async (pin) => {
    await onRevoke(request.id, revokeReason, pin);
    setRevokeReason('');
  };

  // Format time remaining for active grants
  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return '—';
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining`;
  };

  return (
    <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-4 hover:border-black/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-gray-50 border border-black rounded-md text-[#0A0A0A]">
            <RiBuildingLine className="text-xl" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-[#0A0A0A]">
                {request.org_name}
              </h3>
              <span className="text-[11px] font-mono text-[#555555] bg-gray-100 px-2 py-0.5 rounded capitalize">
                {request.org_type || 'Healthcare Provider'}
              </span>
              {request.org_verified === false && (
                <span className="text-[10px] font-medium bg-amber-100 text-[#F59E0B] px-1.5 py-0.2 rounded">
                  Unverified Org
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 mt-1 text-xs text-[#555555]">
              <span className="font-medium text-[#0A0A0A]">
                Purpose: {purposeLabels[request.purpose] || request.purpose}
              </span>
              <span>•</span>
              <span>Duration: {request.duration_hours}h</span>
              <span>•</span>
              <span>{new Date(request.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Status or Time remaining */}
        {isActiveGrant ? (
          <div className="flex items-center space-x-1.5 text-xs font-mono font-medium text-[#16A34A] bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
            <RiTimeLine className="text-sm" />
            <span>{getTimeRemaining(request.expires_at)}</span>
          </div>
        ) : (
          <span
            className={`text-xs font-mono uppercase px-2.5 py-0.5 rounded-full border ${
              request.status === 'pending'
                ? 'bg-amber-50 text-[#F59E0B] border-amber-200'
                : request.status === 'approved'
                ? 'bg-green-50 text-[#16A34A] border-green-200'
                : 'bg-gray-100 text-[#555555] border-gray-200'
            }`}
          >
            {request.status}
          </span>
        )}
      </div>

      {/* Requested Data Categories */}
      <div>
        <span className="text-xs text-[#555555] block mb-1.5">
          {isActiveGrant ? 'Approved Scope:' : 'Requested Scope:'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(request.data_categories || []).map((cat) => (
            <span
              key={cat}
              className="text-xs bg-gray-50 border border-black text-[#0A0A0A] px-2 py-0.5 rounded font-medium"
            >
              {categoryLabels[cat] || cat}
            </span>
          ))}
        </div>
      </div>

      {/* Purpose notes if any */}
      {request.purpose_notes && (
        <p className="text-xs text-[#555555] bg-gray-50/50 p-2.5 rounded border border-dashed border-black">
          Clinical justification: {request.purpose_notes}
        </p>
      )}

      {/* Action buttons */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
        {request.status === 'pending' ? (
          <div className="flex items-center space-x-2 w-full justify-end">
            <button
              onClick={() => onReject(request.id)}
              className="flex items-center space-x-1 text-xs border border-black text-[#555555] hover:text-[#0A0A0A] hover:bg-gray-50 px-3 py-2 rounded-md transition-colors"
            >
              <RiCloseLine className="text-base" />
              <span>Reject</span>
            </button>
            <button
              onClick={handleApproveClick}
              className="flex items-center space-x-1 text-xs font-medium bg-black text-white px-4 py-2 rounded-md hover:bg-[#333333] transition-colors"
            >
              <RiCheckLine className="text-base text-[#16A34A]" />
              <span>Approve (Requires PIN)</span>
            </button>
          </div>
        ) : isActiveGrant ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-1 text-xs text-[#16A34A]">
              <RiShieldCheckLine className="text-sm" />
              <span>Cryptographic grant active</span>
            </div>
            <button
              onClick={() => setRevokeModalOpen(true)}
              className="flex items-center space-x-1 text-xs font-medium bg-[#EF4444] text-white px-3 py-1.5 rounded-md hover:bg-red-600 transition-colors"
            >
              <span>Revoke Access</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-[#555555]">
            {request.status === 'revoked' && `Revoked: ${request.revoke_reason || 'By patient'}`}
            {request.status === 'approved' && `Expired at: ${new Date(request.expires_at).toLocaleString()}`}
          </div>
        )}
      </div>

      {/* Approval PIN Modal */}
      <ConfirmModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onConfirm={handleConfirmPinApprove}
        title="Authorize Medical Data Release"
        message={`You are cryptographically authorizing ${request.org_name} to access strictly the requested categories for ${request.duration_hours} hours. Your RSA private key will be decrypted with your PIN to sign this grant.`}
        requirePin={true}
        pinLabel="Enter your 4-digit PIN to sign authorization"
        confirmText="Authorize & Sign"
      />

      {/* Revocation Modal */}
      {revokeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D0D0D0] rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeSlideIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#D0D0D0]">
              <h3 className="text-base font-semibold text-[#0A0A0A]">
                Revoke Access Authorization
              </h3>
              <button
                onClick={() => setRevokeModalOpen(false)}
                className="text-[#555555] hover:text-[#0A0A0A]"
              >
                <RiCloseLine className="text-xl" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-[#555555]">
                Immediately cuts off data access for {request.org_name}. Future access requests will be rejected until explicitly re-authorized.
              </p>
              <div>
                <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
                  Reason for Revocation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Treatment completed / Privacy concern"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-[#D0D0D0]">
              <button
                onClick={() => setRevokeModalOpen(false)}
                className="px-3 py-1.5 text-xs border border-[#D0D0D0] rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setRevokeModalOpen(false);
                  setPinModalOpen(false);
                  handleConfirmRevoke('1234'); // trigger revoke confirm
                }}
                className="px-3 py-1.5 text-xs bg-[#EF4444] text-white font-medium rounded hover:bg-red-600"
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
