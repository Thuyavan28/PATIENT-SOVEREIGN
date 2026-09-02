import React, { useState, useEffect, useRef } from 'react';
import {
  RiShieldCheckLine,
  RiKeyLine,
  RiFileShieldLine,
  RiLockLine,
  RiCodeSSlashLine,
  RiCheckboxCircleFill,
  RiCloseLine,
  RiAlertLine,
  RiFingerprint2Line,
  RiShieldFlashLine,
  RiCheckLine,
  RiBuildingLine,
  RiTimeLine
} from 'react-icons/ri';

/* ─── 6 cryptographic steps ─────────────────────────────── */
const STEPS = [
  { id: 1, icon: RiFingerprint2Line, label: 'PIN Verification',       detail: 'Running bcrypt comparison against salted hash...', done: 'bcrypt hash match confirmed' },
  { id: 2, icon: RiKeyLine,          label: 'RSA Private Key Decrypt', detail: 'AES-256-CBC using SHA-256(PIN) as key...',           done: '2048-bit private key unlocked' },
  { id: 3, icon: RiFileShieldLine,   label: 'Authorization Payload',   detail: 'Building scoped grant token...',                     done: 'Payload: org_id + patient_id + scope_hash' },
  { id: 4, icon: RiLockLine,         label: 'RSA-PSS Signature',       detail: 'Signing payload with 2048-bit sovereign key...',     done: 'Digital signature created' },
  { id: 5, icon: RiCodeSSlashLine,   label: 'Scope Hash Lock',         detail: 'SHA-256 hash bound to approved categories...',       done: 'Scope boundary locked' },
  { id: 6, icon: RiShieldFlashLine,  label: 'Scoped Data Released',    detail: 'Enforcing: Identity ≠ Authorization ≠ Access...',   done: 'Grant issued — strictly within scope' }
];

/* ─── Small spinner for active step ─────────────────────── */
function StepSpinner() {
  return (
    <span
      className="w-4 h-4 rounded-full border-2 border-[#0A0A0A] border-t-transparent inline-block shrink-0"
      style={{ animation: 'rxSpin 0.7s linear infinite' }}
    />
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function CryptoAuthOverlay({ isOpen, request, onApprove, onClose }) {
  const [phase, setPhase]             = useState('pin');   // pin | signing | success | error
  const [pin, setPin]                 = useState(['', '', '', '']);
  const [pinError, setPinError]       = useState('');
  const [signingStep, setSigningStep] = useState(0);
  const [approvalResult, setApprovalResult] = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const timers = useRef([]);
  const pinRefs = [useRef(), useRef(), useRef(), useRef()];

  /* reset on open */
  useEffect(() => {
    if (isOpen) {
      setPhase('pin');
      setPin(['', '', '', '']);
      setPinError('');
      setSigningStep(0);
      setApprovalResult(null);
      setErrorMsg('');
      setTimeout(() => pinRefs[0].current?.focus(), 80);
    } else {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    }
  }, [isOpen]);

  const addTimer = (fn, ms) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  };

  /* PIN digit handler */
  const handleDigit = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pin];
    next[idx] = val;
    setPin(next);
    setPinError('');
    if (val && idx < 3) pinRefs[idx + 1].current?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) pinRefs[idx - 1].current?.focus();
    if (e.key === 'Enter') submitPin();
  };

  /* Submit PIN → signing animation + API call */
  const submitPin = async () => {
    const pinStr = pin.join('');
    if (pinStr.length !== 4) { setPinError('Enter all 4 digits'); return; }
    setPhase('signing');
    setSigningStep(0);

    const STEP_MS = 650;

    // Animate steps 1→6
    STEPS.forEach((s) => addTimer(() => setSigningStep(s.id), s.id * STEP_MS));

    try {
      const result = await onApprove(request.id, pinStr);
      // Wait for all steps then show success
      addTimer(() => {
        setApprovalResult(result);
        addTimer(() => setPhase('success'), 350);
      }, STEPS.length * STEP_MS + 450);
    } catch (err) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const msg = err.response?.data?.message || err.response?.data?.error || 'Authorization failed';
      if (msg.toLowerCase().includes('pin') || err.response?.data?.error === 'invalid_pin') {
        setPinError('Incorrect PIN — try again');
        setPhase('pin');
        setPin(['', '', '', '']);
        setTimeout(() => pinRefs[0].current?.focus(), 80);
      } else {
        setErrorMsg(msg);
        setPhase('error');
      }
    }
  };

  if (!isOpen || !request) return null;

  const pinStr = pin.join('');

  /* ── Shared close behaviour ── */
  const handleBackdropClick = () => { if (phase === 'pin') onClose(); };

  return (
    /*
     * z-[9999] so it covers sidebar (z-30) + topbar (z-20) completely.
     * The backdrop is semi-transparent black; the panel itself is pure white.
     */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdropClick}
    >
      {/* ── Panel ── click stop-propagation so clicking inside doesn't close */}
      <div
        className="relative bg-white border border-black rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >

        {/* ════════════════════════ PHASE: PIN ════════════════════════ */}
        {phase === 'pin' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-black">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#0A0A0A] rounded-lg flex items-center justify-center">
                  <RiShieldFlashLine className="text-white text-base" />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#555555]">Patient-Sovereign · Zero-Trust</p>
                  <h2 className="text-sm font-bold text-[#0A0A0A] leading-tight">Authorize Medical Data Release</h2>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-[#555555] hover:text-[#0A0A0A] transition-colors">
                <RiCloseLine className="text-lg" />
              </button>
            </div>

            <div className="px-7 py-5 space-y-5">

              {/* Organization card */}
              <div className="flex items-start space-x-3 p-4 bg-gray-50 border border-black rounded-xl">
                <div className="w-9 h-9 bg-white border border-black rounded-lg flex items-center justify-center shrink-0">
                  <RiBuildingLine className="text-base text-[#0A0A0A]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#555555]">Requesting Organization</p>
                  <h3 className="text-sm font-bold text-[#0A0A0A] mt-0.5">{request.org_name}</h3>
                  <p className="text-xs text-[#555555] mt-0.5">
                    Purpose: <span className="font-medium text-[#0A0A0A] capitalize">{(request.purpose || '').replace(/_/g, ' ')}</span>
                    &nbsp;·&nbsp;
                    <RiTimeLine className="inline text-xs" /> {request.duration_hours}h grant
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(request.data_categories || []).map(cat => (
                      <span key={cat} className="text-[10px] font-mono bg-white border border-black text-[#0A0A0A] px-2 py-0.5 rounded-full capitalize">
                        {cat.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Zero-Trust principle — 3 columns */}
              <div className="grid grid-cols-3 gap-2">
                {['Identity', 'Authorization', 'Access'].map((label, i) => (
                  <div key={label} className="relative text-center p-3 bg-gray-50 border border-black rounded-xl">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-[#777777]">Layer {i + 1}</p>
                    <p className="text-xs font-bold text-[#0A0A0A] mt-0.5">{label}</p>
                    {i < 2 && (
                      <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#555555] z-10 select-none">≠</span>
                    )}
                  </div>
                ))}
              </div>

              {/* PIN entry */}
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-xs font-medium text-[#0A0A0A]">Enter your sovereign 4-digit PIN to sign this authorization</p>
                  <p className="text-[11px] text-[#777777] mt-0.5">Your RSA private key will be decrypted and used to sign the grant</p>
                </div>
                <div className="flex justify-center space-x-3">
                  {pin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={pinRefs[idx]}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleDigit(idx, e.target.value)}
                      onKeyDown={e => handleKeyDown(idx, e)}
                      className="w-12 h-12 text-center text-xl font-bold text-[#0A0A0A] bg-gray-50 border border-black rounded-xl focus:ring-2 focus:ring-black focus:bg-white outline-none transition-all caret-transparent"
                    />
                  ))}
                </div>
                {pinError && (
                  <div className="flex items-center justify-center space-x-1.5 text-xs text-[#EF4444]">
                    <RiAlertLine className="shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-2 border-t border-gray-100">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 text-xs font-medium text-[#555555] border border-black rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitPin}
                  disabled={pinStr.length !== 4}
                  className="flex-[2] py-2.5 text-xs font-bold text-white bg-[#0A0A0A] rounded-xl hover:bg-[#222] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  <RiShieldFlashLine className="text-sm" />
                  <span>Authorize &amp; Sign with RSA</span>
                </button>
              </div>

            </div>
          </>
        )}

        {/* ════════════════════════ PHASE: SIGNING ═══════════════════ */}
        {phase === 'signing' && (
          <>
            {/* Progress bar */}
            <div className="h-1 bg-gray-100 rounded-t-2xl overflow-hidden">
              <div
                className="h-full bg-[#0A0A0A] transition-all duration-[650ms] ease-linear"
                style={{ width: `${(signingStep / 6) * 100}%` }}
              />
            </div>

            <div className="px-7 py-7 space-y-6">

              {/* Animated icon + status */}
              <div className="text-center space-y-2">
                <div className="relative inline-flex items-center justify-center w-16 h-16">
                  {/* Outer spin ring */}
                  <span
                    className="absolute inset-0 rounded-full border border-dashed border-black/30"
                    style={{ animation: 'rxSpin 3s linear infinite' }}
                  />
                  {/* Inner pulse ring */}
                  <span className="absolute inset-[8px] rounded-full border border-black/15 animate-ping" />
                  {/* Center */}
                  <span className="relative z-10 w-9 h-9 bg-[#0A0A0A] rounded-xl flex items-center justify-center">
                    <RiShieldFlashLine className="text-white text-lg" />
                  </span>
                </div>
                <p className="text-sm font-bold text-[#0A0A0A]">RSA Digital Signature in Progress...</p>
                <p className="text-[11px] text-[#777777] font-mono">Processing step {signingStep} of 6</p>
              </div>

              {/* Step list */}
              <div className="space-y-2">
                {STEPS.map(step => {
                  const isActive  = signingStep === step.id;
                  const isDone    = signingStep > step.id;
                  const isPending = signingStep < step.id;
                  const StepIcon = step.icon;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-xl border transition-all duration-300 ${
                        isDone    ? 'bg-gray-50 border-black/20 opacity-75' :
                        isActive  ? 'bg-white border-black shadow-sm' :
                                    'bg-transparent border-transparent opacity-30'
                      }`}
                    >
                      {/* Step number */}
                      <span className={`w-6 h-6 rounded-lg text-[10px] font-bold font-mono flex items-center justify-center shrink-0 ${
                        isDone   ? 'bg-[#0A0A0A] text-white' :
                        isActive ? 'bg-[#0A0A0A] text-white' :
                                   'bg-gray-100 text-[#555555]'
                      }`}>
                        {step.id}
                      </span>

                      {/* Icon */}
                      <StepIcon className={`text-base shrink-0 ${isDone || isActive ? 'text-[#0A0A0A]' : 'text-[#555555]'}`} />

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${isDone || isActive ? 'text-[#0A0A0A]' : 'text-[#555555]'}`}>
                          {step.label}
                        </p>
                        <p className="text-[10px] font-mono text-[#777777] truncate">
                          {isDone ? step.done : step.detail}
                        </p>
                      </div>

                      {/* Status indicator */}
                      <div className="shrink-0">
                        {isDone    ? <RiCheckLine className="text-[#0A0A0A] text-base" /> :
                         isActive  ? <StepSpinner /> :
                                     <span className="w-3.5 h-3.5 rounded-full border border-gray-200 inline-block" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════ PHASE: SUCCESS ═══════════════════ */}
        {phase === 'success' && (
          <>
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-black">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#0A0A0A] rounded-lg flex items-center justify-center">
                  <RiCheckLine className="text-white text-base" />
                </div>
                <h2 className="text-sm font-bold text-[#0A0A0A]">Authorization Sealed</h2>
              </div>
            </div>

            <div className="px-7 py-7 space-y-5 text-center">
              {/* Big checkmark */}
              <div className="relative inline-flex items-center justify-center w-20 h-20">
                <span
                  className="absolute inset-0 rounded-full border border-dashed border-black/20"
                  style={{ animation: 'rxSpin 4s linear infinite' }}
                />
                <span className="relative z-10 w-12 h-12 bg-[#0A0A0A] rounded-xl flex items-center justify-center">
                  <RiCheckboxCircleFill className="text-white text-2xl" />
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#0A0A0A]">Access Granted</h3>
                <p className="text-xs text-[#555555] mt-1">
                  <span className="font-medium text-[#0A0A0A]">{request.org_name}</span> has been cryptographically authorized with your sovereign RSA key
                </p>
              </div>

              {/* Scope summary box */}
              <div className="text-left p-4 bg-gray-50 border border-black rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#555555]">Authorized Scope</span>
                  <span className="text-[10px] font-mono text-[#0A0A0A] bg-white border border-black px-2 py-0.5 rounded-full">STRICTLY BOUNDED</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(request.data_categories || []).map(cat => (
                    <span key={cat} className="text-[10px] font-mono bg-white border border-black text-[#0A0A0A] px-2 py-0.5 rounded-full capitalize">
                      {cat.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                {approvalResult?.expires_at && (
                  <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-gray-200">
                    <span className="text-[#555555]">Grant expires:</span>
                    <span className="font-medium text-[#0A0A0A]">{new Date(approvalResult.expires_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <p className="text-[10px] font-mono text-[#777777]">Identity ≠ Authorization ≠ Access · Zero-Trust Enforced</p>

              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs font-bold text-white bg-[#0A0A0A] rounded-xl hover:bg-[#222] transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}

        {/* ════════════════════════ PHASE: ERROR ═════════════════════ */}
        {phase === 'error' && (
          <>
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-black">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#EF4444] rounded-lg flex items-center justify-center">
                  <RiAlertLine className="text-white text-base" />
                </div>
                <h2 className="text-sm font-bold text-[#0A0A0A]">Authorization Failed</h2>
              </div>
            </div>
            <div className="px-7 py-7 space-y-5 text-center">
              <p className="text-xs text-[#555555]">{errorMsg}</p>
              <div className="flex space-x-3">
                <button onClick={onClose} className="flex-1 py-2.5 text-xs border border-black rounded-xl hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => { setPhase('pin'); setPin(['', '', '', '']); setErrorMsg(''); }}
                  className="flex-1 py-2.5 text-xs font-bold bg-[#0A0A0A] text-white rounded-xl hover:bg-[#222]"
                >
                  Try Again
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}



