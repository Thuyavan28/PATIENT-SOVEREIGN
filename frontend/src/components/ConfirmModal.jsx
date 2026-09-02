import React, { useState } from 'react';
import { RiCloseLine, RiAlertLine } from 'react-icons/ri';
import PinInput from './PinInput';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  requirePin = false,
  pinLabel = 'Enter your 4-digit PIN to authorize this action',
  confirmText = 'Confirm',
  danger = false
}) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (requirePin && pin.length !== 4) {
      setPinError('PIN must be 4 digits');
      return;
    }
    setPinError(false);
    setLoading(true);
    try {
      await onConfirm(pin);
      setPin('');
      onClose();
    } catch (err) {
      const isPinError = err.response?.data?.error === 'invalid_pin';
      if (isPinError) {
        setPinError('Incorrect 4-digit PIN');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setPinError(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white border border-black rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeSlideIn">
        <div className="flex items-center justify-between pb-3 border-b border-black">
          <div className="flex items-center space-x-2 text-[#0A0A0A]">
            {danger && <RiAlertLine className="text-[#EF4444] text-lg" />}
            <h3 className="text-base font-semibold">{title}</h3>
          </div>
          <button onClick={handleClose} className="text-[#555555] hover:text-[#0A0A0A]">
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        <div className="py-4">
          <p className="text-sm text-[#555555] leading-relaxed">{message}</p>

          {requirePin && (
            <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col items-center">
              <label className="text-xs font-medium text-[#0A0A0A] mb-3">
                {pinLabel}
              </label>
              <PinInput
                value={pin}
                onChange={(p) => {
                  setPin(p);
                  if (pinError) setPinError(false);
                }}
                error={pinError}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-black">
          <button
            onClick={handleClose}
            disabled={loading}
            className="border border-black rounded-md px-4 py-2 text-sm text-[#555555] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (requirePin && pin.length !== 4)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors text-white ${
              danger
                ? 'bg-[#EF4444] hover:bg-red-600'
                : 'bg-[#000000] hover:bg-[#333333]'
            } disabled:opacity-50`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
