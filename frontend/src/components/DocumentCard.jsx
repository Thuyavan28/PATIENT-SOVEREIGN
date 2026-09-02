import React, { useState } from 'react';
import {
  RiFolderLine,
  RiFileTextLine,
  RiDownloadLine,
  RiEyeLine,
  RiShieldCheckLine,
  RiDeleteBinLine,
  RiCloseLine,
  RiCheckLine,
  RiErrorWarningLine
} from 'react-icons/ri';
import api from '../lib/api';
import { toast } from '../lib/toast';
import ConfirmModal from './ConfirmModal';

export default function DocumentCard({ doc, onDeleted }) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fullDoc, setFullDoc] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState(null); // 'checking', 'intact', 'tampered'

  const typeLabels = {
    lab_report: 'Lab Report',
    xray: 'X-Ray',
    scan: 'Scan',
    discharge_summary: 'Discharge Summary',
    insurance_doc: 'Insurance Document',
    other: 'Other'
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFetchFull = async () => {
    if (fullDoc) return fullDoc;
    setLoadingPreview(true);
    try {
      const res = await api.get(`/documents/${doc.id}`);
      setFullDoc(res.data);
      return res.data;
    } catch (err) {
      toast.error('Failed to load document content');
      throw err;
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async () => {
    try {
      const data = await handleFetchFull();
      const link = document.createElement('a');
      link.href = data.file_data.startsWith('data:')
        ? data.file_data
        : `data:${data.mime_type};base64,${data.file_data}`;
      link.download = data.file_name || `${data.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Document downloaded');
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const handlePreview = async () => {
    try {
      await handleFetchFull();
      setPreviewOpen(true);
    } catch (err) {
      // Handled in handleFetchFull
    }
  };

  const handleVerifyIntegrity = async () => {
    setIntegrityStatus('checking');
    try {
      const data = await handleFetchFull();
      if (data.integrity_intact) {
        setIntegrityStatus('intact');
        toast.success('Document cryptographic SHA-256 hash verified: Intact');
      } else {
        setIntegrityStatus('tampered');
        toast.error('Hash mismatch — possible document tampering detected!');
      }
    } catch (err) {
      setIntegrityStatus(null);
    }
  };

  const handleDeleteWithPin = async (pin) => {
    await api.delete(`/documents/${doc.id}`, { data: { pin } });
    toast.success('Medical document deleted securely');
    if (onDeleted) onDeleted(doc.id);
  };

  const previewSource = fullDoc?.file_data
    ? fullDoc.file_data.startsWith('data:')
      ? fullDoc.file_data
      : `data:${fullDoc.mime_type};base64,${fullDoc.file_data}`
    : '';

  return (
    <div className="bg-white border border-black rounded-lg p-5 shadow-sm space-y-3 hover:border-black/30 transition-colors flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-gray-50 border border-black rounded-md text-[#0A0A0A]">
              <RiFolderLine className="text-xl" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-[#555555] uppercase tracking-wider block">
                {typeLabels[doc.document_type] || doc.document_type}
              </span>
              <h3 className="text-sm font-semibold text-[#0A0A0A] line-clamp-1">
                {doc.title}
              </h3>
            </div>
          </div>

          <span className="text-[11px] font-mono text-[#555555] bg-gray-100 px-2 py-0.5 rounded">
            {formatBytes(doc.file_size)}
          </span>
        </div>

        {/* Description */}
        {doc.description ? (
          <p className="mt-2.5 text-xs text-[#555555] line-clamp-2">
            {doc.description}
          </p>
        ) : (
          <p className="mt-2.5 text-xs text-gray-400 italic">No description provided</p>
        )}

        {/* Metadata info */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#555555]">
          <span>Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}</span>
          <span className="font-mono text-[10px] truncate max-w-[110px]" title={doc.content_hash}>
            SHA: {doc.content_hash.slice(0, 8)}...
          </span>
        </div>

        {/* Integrity status alert if checked */}
        {integrityStatus === 'intact' && (
          <div className="mt-2 p-1.5 bg-green-50 border border-green-200 rounded text-[11px] font-medium text-[#16A34A] flex items-center space-x-1">
            <RiCheckLine className="text-sm" />
            <span>Document intact & verified</span>
          </div>
        )}
        {integrityStatus === 'tampered' && (
          <div className="mt-2 p-1.5 bg-red-50 border border-red-200 rounded text-[11px] font-medium text-[#EF4444] flex items-center space-x-1">
            <RiErrorWarningLine className="text-sm" />
            <span>Hash mismatch — possible tampering!</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="pt-3 border-t border-black flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <button
            onClick={handlePreview}
            title="View inline"
            className="p-1.5 text-[#555555] hover:text-[#0A0A0A] hover:bg-gray-100 rounded transition-colors"
          >
            <RiEyeLine className="text-base" />
          </button>
          <button
            onClick={handleDownload}
            title="Download document"
            className="p-1.5 text-[#555555] hover:text-[#0A0A0A] hover:bg-gray-100 rounded transition-colors"
          >
            <RiDownloadLine className="text-base" />
          </button>
          <button
            onClick={handleVerifyIntegrity}
            title="Verify SHA-256 integrity"
            className="p-1.5 text-[#555555] hover:text-[#16A34A] hover:bg-gray-100 rounded transition-colors"
          >
            <RiShieldCheckLine className="text-base" />
          </button>
        </div>

        <button
          onClick={() => setDeleteModalOpen(true)}
          title="Delete document (PIN required)"
          className="p-1.5 text-[#555555] hover:text-[#EF4444] hover:bg-red-50 rounded transition-colors"
        >
          <RiDeleteBinLine className="text-base" />
        </button>
      </div>

      {/* PIN-Protected Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteWithPin}
        title="Confirm Document Deletion"
        message={`Deleting "${doc.title}" will soft-delete this record from your vault and append an immutable deletion record to your cryptographic audit log.`}
        requirePin={true}
        pinLabel="Enter your 4-digit PIN to authorize document deletion"
        confirmText="Delete Document"
        danger
      />

      {/* Inline Preview Modal */}
      {previewOpen && fullDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-black rounded-xl shadow-2xl max-w-3xl w-full h-[80vh] flex flex-col p-6 animate-fadeSlideIn">
            <div className="flex items-center justify-between pb-3 border-b border-black">
              <div>
                <h3 className="text-base font-semibold text-[#0A0A0A]">{fullDoc.title}</h3>
                <span className="text-xs text-[#555555] font-mono">{fullDoc.file_name}</span>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-[#555555] hover:text-[#0A0A0A]"
              >
                <RiCloseLine className="text-2xl" />
              </button>
            </div>

            <div className="flex-1 my-4 overflow-hidden rounded bg-gray-100 flex items-center justify-center">
              {fullDoc.mime_type.includes('image') ? (
                <img
                  src={previewSource}
                  alt={fullDoc.title}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <iframe
                  src={previewSource}
                  title={fullDoc.title}
                  className="w-full h-full border-none"
                />
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-black">
              <div className="text-xs font-mono text-[#555555]">
                SHA-256: {fullDoc.content_hash}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 border border-black text-xs font-medium rounded-md hover:bg-gray-50 flex items-center space-x-1.5"
                >
                  <RiDownloadLine className="text-sm" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="px-4 py-2 bg-black text-white text-xs font-medium rounded-md hover:bg-[#333333]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
