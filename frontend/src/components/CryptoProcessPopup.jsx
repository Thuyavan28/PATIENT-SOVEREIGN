import React, { useState, useEffect } from 'react';
import {
  RiShieldCheckLine,
  RiKeyLine,
  RiFileTextLine,
  RiLockLine,
  RiCodeLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiCheckboxCircleFill,
  RiCloseLine
} from 'react-icons/ri';

const DEFAULT_STEPS = [
  {
    step: 1,
    icon: RiShieldCheckLine,
    label: 'PIN Verified',
    detail: 'bcrypt comparison against salted hash successful'
  },
  {
    step: 2,
    icon: RiKeyLine,
    label: 'Private Key Decrypted',
    detail: 'AES-256-CBC cipher decrypted using SHA-256(PIN)'
  },
  {
    step: 3,
    icon: RiFileTextLine,
    label: 'Authorization Payload Built',
    detail: 'Cryptographic grant token with purpose & category boundaries'
  },
  {
    step: 4,
    icon: RiLockLine,
    label: 'RSA-PSS Signature Created',
    detail: '2048-bit digital signature signed by patient sovereign key'
  },
  {
    step: 5,
    icon: RiCodeLine,
    label: 'Scope Hash Verified',
    detail: 'SHA-256 hash locked to approved medical categories only'
  },
  {
    step: 6,
    icon: RiCheckboxCircleLine,
    label: 'Scoped Data Released',
    detail: 'Identity ≠ Authorization ≠ Access strictly enforced'
  }
];

export default function CryptoProcessPopup({
  isOpen,
  onClose,
  approvalData, // { steps: [...], expires_at: '...' }
  onComplete
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setActiveStep(0);
      setIsDone(false);
      return;
    }

    // Step progression every 600ms
    const intervals = [];
    for (let i = 1; i <= 6; i++) {
      const timer = setTimeout(() => {
        setActiveStep(i);
      }, i * 600);
      intervals.push(timer);
    }

    // Done state at 3600ms
    const doneTimer = setTimeout(() => {
      setIsDone(true);
      if (onComplete) onComplete();
    }, 3800);
    intervals.push(doneTimer);

    // Auto-close 1500ms after completion
    const closeTimer = setTimeout(() => {
      if (onClose) onClose();
    }, 5400);
    intervals.push(closeTimer);

    return () => {
      intervals.forEach(clearTimeout);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const stepsData = DEFAULT_STEPS.map((s, idx) => {
    if (approvalData?.steps && approvalData.steps[idx]) {
      return {
        ...s,
        label: approvalData.steps[idx].label || s.label,
        detail: approvalData.steps[idx].detail || s.detail
      };
    }
    return s;
  });

  const formattedExpiry = approvalData?.expires_at
    ? new Date(approvalData.expires_at).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : '24 hours from now';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="relative bg-white border border-black rounded-xl shadow-2xl max-w-lg w-full overflow-hidden p-8 animate-fadeSlideIn">
        
        {/* Animated Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <div
            className="h-full bg-[#000000] transition-all duration-[3600ms] ease-linear"
            style={{ width: isDone ? '100%' : `${Math.min((activeStep / 6) * 100, 100)}%` }}
          />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#555555] hover:text-[#0A0A0A] p-1 rounded-md transition-colors"
        >
          <RiCloseLine className="text-xl" />
        </button>

        {/* Title */}
        <div className="mb-6">
          <span className="text-xs font-mono uppercase tracking-wider text-[#555555] block mb-1">
            Zero-Trust Verification
          </span>
          <h2 className="text-lg font-semibold text-[#0A0A0A]">
            Cryptographic Authorization
          </h2>
        </div>

        {/* Content: Steps or Finalized Check */}
        {!isDone ? (
          <div className="space-y-4">
            {stepsData.map((s, index) => {
              const stepNumber = index + 1;
              const isRevealed = activeStep >= stepNumber;
              const isFinished = activeStep > stepNumber;
              const StepIcon = s.icon;

              if (!isRevealed) return null;

              return (
                <div
                  key={s.step}
                  className="flex items-start space-x-3.5 animate-fadeSlideIn py-1"
                >
                  {/* Step circle */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-mono transition-colors duration-200 ${
                      isFinished
                        ? 'bg-[#000000] text-white'
                        : activeStep === stepNumber
                        ? 'bg-[#000000] text-white ring-2 ring-black/20 animate-pulse'
                        : 'bg-gray-100 text-[#555555]'
                    }`}
                  >
                    {stepNumber}
                  </div>

                  {/* Icon */}
                  <div className="pt-0.5 text-lg text-[#0A0A0A]">
                    <StepIcon />
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#0A0A0A] leading-tight">
                      {s.label}
                    </div>
                    <div className="text-xs text-[#555555] font-mono mt-0.5 truncate">
                      {s.detail}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0 pt-0.5">
                    {isFinished ? (
                      <RiCheckLine className="text-[#16A34A] text-lg" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-black animate-spin mt-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-fadeSlideIn">
            <RiCheckboxCircleFill className="text-[#16A34A] text-6xl mb-3" />
            <h3 className="text-xl font-semibold text-[#0A0A0A]">
              Access Authorized
            </h3>
            <p className="text-sm text-[#555555] mt-1">
              Cryptographically signed with patient RSA private key.
            </p>
            <div className="mt-4 px-3 py-1.5 bg-gray-50 border border-black rounded-md text-xs font-mono text-[#555555]">
              Expires at: {formattedExpiry}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
