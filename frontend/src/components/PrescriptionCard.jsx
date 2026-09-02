import React, { useState } from 'react';
import {
  RiCapsuleLine,
  RiShieldCheckLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiAlertLine,
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiDeleteBinLine
} from 'react-icons/ri';

import api from '../lib/api';
import { toast } from '../lib/toast';

export default function PrescriptionCard({ rx, onRefresh, onDeleted }) {
  const [expandedChain, setExpandedChain] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePin, setDeletePin] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletePinError, setDeletePinError] = useState('');


  const statusColors = {
    active: 'bg-green-50 text-[#16A34A] border-green-200',
    dispensed: 'bg-gray-100 text-[#555555] border-gray-300',
    expired: 'bg-red-50 text-[#EF4444] border-red-200',
    cancelled: 'bg-red-50 text-[#EF4444] border-red-200'
  };

  const aiWarnings = typeof rx.ai_warnings === 'string'
    ? JSON.parse(rx.ai_warnings || '{}')
    : (rx.ai_warnings || {});

  const hasAiWarning = aiWarnings && aiWarnings.safe === false;

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.get(`/prescriptions/${rx.id}/verify`);
      setVerificationResult(res.data);
      setVerifyModalOpen(true);
    } catch (err) {
      toast.error('Failed to verify prescription integrity');
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    if (deletePin.length !== 4) {
      setDeletePinError('Please enter your 4-digit PIN');
      return;
    }
    setDeletePinError('');
    setDeleteLoading(true);
    try {
      await api.delete(`/prescriptions/${rx.id}`, { data: { pin: deletePin } });
      toast.success(`Prescription for ${rx.drug_name} deleted`);
      setDeleteModalOpen(false);
      if (onDeleted) onDeleted(rx.id);
      else if (onRefresh) onRefresh();
    } catch (err) {
      if (err.response?.data?.error === 'invalid_pin') {
        setDeletePinError('Incorrect PIN — please try again');
        setDeletePin('');
      } else {
        toast.error(err.response?.data?.error || 'Failed to delete prescription');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeletePin('');
    setDeletePinError('');
  };


  return (
    <div className="bg-white border border-black rounded-2xl p-6 shadow-sm space-y-4 hover:border-black transition-colors font-sans">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-gray-50 border border-[#D0D0D0] rounded-xl text-[#0A0A0A] mt-0.5">
            <RiCapsuleLine className="text-xl" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-medium font-sans text-[#0A0A0A]">
                {rx.drug_name}
              </h3>
              <span className="text-xs font-sans font-medium bg-gray-100 px-2 py-0.5 rounded-lg text-[#0A0A0A]">
                {rx.dosage}
              </span>
            </div>
            <p className="text-xs font-normal font-sans text-[#555555] mt-0.5">
              {rx.frequency} {rx.duration ? `• ${rx.duration}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasAiWarning && (
            <span className="inline-flex items-center space-x-1 text-[11px] font-medium font-sans bg-amber-50 text-[#F59E0B] border border-amber-200 px-2.5 py-0.5 rounded-full">
              <RiAlertLine className="text-xs" />
              <span>Safety Warning</span>
            </span>
          )}

          <span
            className={`text-xs font-sans uppercase px-2.5 py-0.5 rounded-full border ${
              statusColors[rx.status] || statusColors.active
            }`}
          >
            {rx.status}
          </span>
        </div>
      </div>

      {/* Doctor & Prescription Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50/70 border border-gray-200/80 rounded-xl p-3 font-sans">
        <div>
          <span className="text-[#555555] block font-normal">Prescriber</span>
          <span className="font-medium font-sans text-[#0A0A0A]">{rx.doctor_name}</span>
          {rx.doctor_reg && (
            <span className="text-[10px] text-[#555555] block font-mono">
              Reg: {rx.doctor_reg}
            </span>
          )}
        </div>
        <div>
          <span className="text-[#555555] block font-normal">Diagnosis</span>
          <span className="font-medium font-sans text-[#0A0A0A]">{rx.diagnosis || '—'}</span>
        </div>
        <div>
          <span className="text-[#555555] block font-normal">Issued Date</span>
          <span className="font-medium font-sans text-[#0A0A0A]">
            {new Date(rx.issued_date).toLocaleDateString()}
          </span>
        </div>
        <div>
          <span className="text-[#555555] block font-normal">Expiry Date</span>
          <span className="font-medium font-sans text-[#0A0A0A]">
            {rx.expiry_date ? new Date(rx.expiry_date).toLocaleDateString() : 'No expiry'}
          </span>
        </div>
      </div>

      {/* Notes if present */}
      {rx.notes && (
        <p className="text-xs font-normal font-sans text-[#555555] bg-gray-50 p-2.5 rounded-xl border border-gray-100">
          Notes: {rx.notes}
        </p>
      )}

        {/* Action buttons */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between font-sans">
          <button
            onClick={() => setExpandedChain(!expandedChain)}
            className="flex items-center space-x-1 text-xs font-medium font-sans text-[#555555] hover:text-[#0A0A0A] transition-colors"
          >
            <span>Hash Chain Details</span>
            {expandedChain ? (
              <RiArrowUpSLine className="text-sm" />
            ) : (
              <RiArrowDownSLine className="text-sm" />
            )}
          </button>

          <div className="flex items-center space-x-2">
            {/* Delete button — only for non-cancelled prescriptions */}
            {rx.status !== 'cancelled' && (
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#EF4444] text-[#EF4444] bg-white hover:bg-[#EF4444] hover:text-white rounded-xl text-xs font-medium font-sans transition-colors"
              >
                <RiDeleteBinLine className="text-sm" />
                <span>Delete</span>
              </button>
            )}

            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#0A0A0A] text-[#0A0A0A] bg-white hover:bg-black hover:text-white rounded-xl text-xs font-medium font-sans transition-colors disabled:opacity-50"
            >
              <RiShieldCheckLine className="text-sm" />
              <span>{verifying ? 'Verifying...' : 'Verify Integrity'}</span>
            </button>
          </div>
        </div>


      {/* Collapsible Hash Chain Block */}
      {expandedChain && (
        <div className="bg-gray-50 border border-[#D0D0D0] rounded-md p-3 text-xs font-mono space-y-1.5 animate-fadeSlideIn">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#555555]">Content Hash (SHA-256):</span>
            <span className="text-[#0A0A0A] select-all truncate max-w-[240px]">
              {rx.content_hash}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#555555]">Previous Chain Hash:</span>
            <span className="text-[#0A0A0A] select-all truncate max-w-[240px]">
              {rx.prev_hash}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#555555]">Block Chain Hash:</span>
            <span className="font-bold text-[#0A0A0A] select-all truncate max-w-[240px]">
              {rx.chain_hash}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px] pt-1 border-t border-gray-200">
            <span className="text-[#555555]">RSA-PSS Signature:</span>
            <span className="text-[#0A0A0A] select-all truncate max-w-[240px]">
              {rx.signature?.slice(0, 32)}...
            </span>
          </div>
        </div>
      )}

      {/* Verification Results Modal */}
      {verifyModalOpen && verificationResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-[#D0D0D0] rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeSlideIn">
            <div className="flex items-center justify-between pb-3 border-b border-[#D0D0D0]">
              <div className="flex items-center space-x-2">
                <RiShieldCheckLine className="text-xl text-[#0A0A0A]" />
                <h3 className="text-base font-semibold text-[#0A0A0A]">
                  Prescription Cryptographic Verification
                </h3>
              </div>
              <button
                onClick={() => setVerifyModalOpen(false)}
                className="text-[#555555] hover:text-[#0A0A0A]"
              >
                <RiCloseLine className="text-xl" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="text-xs text-[#555555]">
                Verification executed directly against patient sovereign public key and stored hash chain:
              </div>

              {/* Hash Match */}
              <div className="flex items-center justify-between p-3 rounded-md bg-gray-50 border border-[#D0D0D0]">
                <span className="text-xs font-medium text-[#0A0A0A]">Canonical Content Hash Match</span>
                {verificationResult.hash_match ? (
                  <span className="flex items-center space-x-1 text-xs font-semibold text-[#16A34A]">
                    <RiCheckLine className="text-base" />
                    <span>Matched</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-xs font-semibold text-[#EF4444]">
                    <RiCloseLine className="text-base" />
                    <span>Mismatch (Tampered)</span>
                  </span>
                )}
              </div>

              {/* Signature Valid */}
              <div className="flex items-center justify-between p-3 rounded-md bg-gray-50 border border-[#D0D0D0]">
                <span className="text-xs font-medium text-[#0A0A0A]">RSA-PSS Digital Signature</span>
                {verificationResult.signature_valid ? (
                  <span className="flex items-center space-x-1 text-xs font-semibold text-[#16A34A]">
                    <RiCheckLine className="text-base" />
                    <span>Valid</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-xs font-semibold text-[#EF4444]">
                    <RiCloseLine className="text-base" />
                    <span>Invalid Signature</span>
                  </span>
                )}
              </div>

              {/* Chain Valid */}
              <div className="flex items-center justify-between p-3 rounded-md bg-gray-50 border border-[#D0D0D0]">
                <span className="text-xs font-medium text-[#0A0A0A]">Hash Chain Continuity</span>
                {verificationResult.chain_valid ? (
                  <span className="flex items-center space-x-1 text-xs font-semibold text-[#16A34A]">
                    <RiCheckLine className="text-base" />
                    <span>Intact</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-xs font-semibold text-[#EF4444]">
                    <RiCloseLine className="text-base" />
                    <span>Broken Chain</span>
                  </span>
                )}
              </div>

              {/* Overall status */}
              <div className="mt-4 pt-3 border-t border-gray-100 text-center">
                {!verificationResult.tampered ? (
                  <div className="text-sm font-semibold text-[#16A34A] flex items-center justify-center space-x-1.5">
                    <RiCheckLine className="text-lg" />
                    <span>Prescription Proven Authentic & Untampered</span>
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-[#EF4444] flex items-center justify-center space-x-1.5">
                    <RiErrorWarningLine className="text-lg" />
                    <span>Tamper Detected: Record Invalid</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#D0D0D0]">
              <button
                onClick={() => setVerifyModalOpen(false)}
                className="px-4 py-2 bg-black text-white text-xs font-medium rounded-md hover:bg-[#333333]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Prescription Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-black rounded-2xl shadow-2xl max-w-md w-full animate-fadeSlideIn">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#EF4444] rounded-lg flex items-center justify-center">
                  <RiDeleteBinLine className="text-white text-base" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0A0A0A]">Delete Prescription</h3>
                  <p className="text-[10px] text-[#555555] mt-0.5">Patient Sovereign Right to Erasure</p>
                </div>
              </div>
              <button onClick={closeDeleteModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#555555]">
                <RiCloseLine className="text-lg" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="p-3 bg-red-50 border border-[#EF4444]/30 rounded-xl text-xs text-red-900 leading-relaxed">
                You are about to permanently delete the prescription for <strong className="text-black font-semibold">{rx.drug_name}</strong> ({rx.dosage}, prescribed by {rx.doctor_name || 'physician'}). This action cannot be undone.
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
                  Authorize Deletion with your 4-digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={deletePin}
                  autoFocus
                  onChange={e => {
                    setDeletePin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    if (deletePinError) setDeletePinError('');
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && deletePin.length === 4 && !deleteLoading) {
                      handleDelete();
                    }
                  }}
                  className={`w-full text-xs border rounded-xl px-3 py-2 outline-none focus:ring-1 text-center tracking-[0.5em] text-xl font-bold transition-colors ${
                    deletePinError
                      ? 'border-[#EF4444] focus:ring-[#EF4444] bg-red-50'
                      : 'border-black focus:ring-black'
                  }`}
                />
                {deletePinError && (
                  <div className="flex items-center space-x-1.5 mt-1.5">
                    <RiAlertLine className="text-[#EF4444] text-xs shrink-0" />
                    <p className="text-[11px] text-[#EF4444] font-medium">{deletePinError}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex space-x-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="flex-1 py-2 text-xs border border-black rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading || deletePin.length !== 4}
                className="flex-1 py-2 text-xs font-bold bg-[#EF4444] text-white rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center space-x-1.5"
              >
                {deleteLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <RiDeleteBinLine className="text-sm" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

