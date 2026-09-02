import React, { useState, useEffect, useRef } from 'react';
import {
  RiShieldCheckLine,
  RiKeyLine,
  RiFileShieldLine,
  RiLockPasswordLine,
  RiCodeSSlashLine,
  RiCheckboxCircleFill,
  RiCloseLine,
  RiAlertLine,
  RiFingerprint2Line,
  RiShieldFlashLine,
  RiCheckLine,
  RiLoader4Line,
  RiBuildingLine
} from 'react-icons/ri';

// 6-Step RSA signing pipeline
const CRYPTO_STEPS = [
  {
    id: 1,
    icon: RiFingerprint2Line,
    title: 'PIN Verification',
    detail: 'Running bcrypt comparison against salted hash...',
    done: 'bcrypt hash match confirmed ✓',
    color: '#6366f1'
  },
  {
    id: 2,
    icon: RiKeyLine,
    title: 'RSA Private Key Decrypt',
    detail: 'AES-256-CBC decryption with SHA-256(PIN) key...',
    done: '2048-bit private key unlocked ✓',
    color: '#8b5cf6'
  },
  {
    id: 3,
    icon: RiFileShieldLine,
    title: 'Authorization Payload',
    detail: 'Building scoped grant token with org, purpose & categories...',
    done: 'Payload: org_id + patient_id + scope_hash ✓',
    color: '#0ea5e9'
  },
  {
    id: 4,
    icon: RiLockPasswordLine,
    title: 'RSA-PSS Signature',
    detail: 'Signing payload with RSA-PSS + SHA-256 digest...',
    done: '2048-bit digital signature created ✓',
    color: '#10b981'
  },
  {
    id: 5,
    icon: RiCodeSSlashLine,
    title: 'Scope Hash Lock',
    detail: 'SHA-256 hash binding scope to approved categories only...',
    done: 'Scope boundary cryptographically locked ✓',
    color: '#f59e0b'
  },
  {
    id: 6,
    icon: RiShieldFlashLine,
    title: 'Scoped Data Released',
    detail: 'Enforcing: Identity ≠ Authorization ≠ Access...',
    done: 'Grant issued — strictly within approved scope ✓',
    color: '#16a34a'
  }
];

// Animated background hex pattern
function HexGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.04]">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hex" x="0" y="0" width="56" height="64" patternUnits="userSpaceOnUse">
            <polygon
              points="28,2 54,16 54,48 28,62 2,48 2,16"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)" />
      </svg>
    </div>
  );
}

// Spinning ring component
function SpinningRing({ size, duration, color, opacity = 0.3 }) {
  return (
    <div
      className="absolute rounded-full border"
      style={{
        width: size,
        height: size,
        borderColor: `${color}`,
        borderTopColor: 'transparent',
        opacity,
        animation: `spin ${duration}s linear infinite`,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }}
    />
  );
}

export default function CryptoAuthOverlay({
  isOpen,
  request,         // the access request object
  onApprove,       // async fn(requestId, pin) => Promise<approvalData>
  onClose
}) {
  const [phase, setPhase] = useState('pin');   // 'pin' | 'signing' | 'success' | 'error'
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [signingStep, setSigningStep] = useState(0); // 0..6
  const [completedSteps, setCompletedSteps] = useState([]);
  const [approvalResult, setApprovalResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pinRefs = [useRef(), useRef(), useRef(), useRef()];
  const timeoutsRef = useRef([]);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setPhase('pin');
      setPin(['', '', '', '']);
      setPinError('');
      setSigningStep(0);
      setCompletedSteps([]);
      setApprovalResult(null);
      setErrorMsg('');
      setTimeout(() => pinRefs[0].current?.focus(), 100);
    } else {
      // Clear all timers on close
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    }
  }, [isOpen]);

  const handlePinDigit = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pin];
    next[idx] = val;
    setPin(next);
    setPinError('');
    if (val && idx < 3) {
      pinRefs[idx + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus();
    }
    if (e.key === 'Enter') {
      handleAuthorize();
    }
  };

  const handleAuthorize = async () => {
    const pinStr = pin.join('');
    if (pinStr.length !== 4) {
      setPinError('Enter all 4 digits of your PIN');
      return;
    }

    setPhase('signing');
    setSigningStep(0);
    setCompletedSteps([]);

    // Animate steps 1-6 while waiting for API
    const stepDelay = 700;
    for (let i = 1; i <= 6; i++) {
      const t = setTimeout(() => {
        setSigningStep(i);
      }, i * stepDelay);
      timeoutsRef.current.push(t);
    }

    try {
      // Call API (happens in parallel with animation)
      const result = await onApprove(request.id, pinStr);

      // Wait for animation to finish (step 6 shown + small pause)
      const donePause = setTimeout(() => {
        setCompletedSteps([1, 2, 3, 4, 5, 6]);
        setApprovalResult(result);

        const successTimer = setTimeout(() => {
          setPhase('success');
        }, 400);
        timeoutsRef.current.push(successTimer);
      }, 6 * stepDelay + 300);
      timeoutsRef.current.push(donePause);

    } catch (err) {
      // Clear animation timers
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];

      const msg = err.response?.data?.message || err.response?.data?.error || 'Authorization failed';
      if (msg.includes('invalid_pin') || msg.toLowerCase().includes('pin')) {
        setPinError('Incorrect PIN. Try again.');
        setPhase('pin');
        setPin(['', '', '', '']);
        setTimeout(() => pinRefs[0].current?.focus(), 100);
      } else {
        setErrorMsg(msg);
        setPhase('error');
      }
    }
  };

  if (!isOpen || !request) return null;

  const pinStr = pin.join('');
  const isSigningComplete = completedSteps.length === 6;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Dark backdrop with blur */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={phase === 'pin' ? onClose : undefined} />
      
      {/* Animated background pattern */}
      <HexGrid />

      {/* Floating decorative rings (always visible) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <SpinningRing size="700px" duration="25" color="#ffffff" opacity={0.03} />
        <SpinningRing size="500px" duration="15" color="#6366f1" opacity={0.06} />
        <SpinningRing size="300px" duration="8" color="#8b5cf6" opacity={0.08} />
      </div>

      {/* Main Panel */}
      <div className="relative z-10 w-full max-w-2xl mx-4">

        {/* ── PHASE: PIN ENTRY ─────────────────────────────── */}
        {phase === 'pin' && (
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header band */}
            <div className="bg-white/5 border-b border-white/10 px-8 py-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <RiShieldFlashLine className="text-white text-xl" />
                </div>
                <div>
                  <p className="text-white/50 text-[10px] font-mono uppercase tracking-widest">Patient-Sovereign · Zero-Trust</p>
                  <h2 className="text-white text-base font-bold tracking-tight">Authorize Medical Data Release</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <RiCloseLine className="text-xl" />
              </button>
            </div>

            <div className="p-8 space-y-7">
              {/* Organization info card */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start space-x-4">
                <div className="p-3 bg-white/10 rounded-xl shrink-0">
                  <RiBuildingLine className="text-white text-2xl" />
                </div>
                <div className="min-w-0">
                  <p className="text-white/50 text-[10px] font-mono uppercase tracking-widest mb-1">Requesting Organization</p>
                  <h3 className="text-white text-lg font-bold">{request.org_name}</h3>
                  <p className="text-white/60 text-xs mt-1">
                    Purpose: <span className="text-white font-medium capitalize">{request.purpose?.replace('_', ' ')}</span>
                    {' · '}Duration: <span className="text-white font-medium">{request.duration_hours}h</span>
                  </p>
                  {/* Scope chips */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(request.data_categories || []).map(cat => (
                      <span key={cat} className="text-[10px] font-mono bg-white/10 border border-white/20 text-white/80 px-2 py-0.5 rounded-full capitalize">
                        {cat.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Architecture principle */}
              <div className="grid grid-cols-3 gap-3 text-center">
                {['Identity', 'Authorization', 'Access'].map((label, i) => (
                  <div key={label} className="relative bg-white/5 border border-white/10 rounded-xl p-3">
                    <p className="text-white/40 text-[9px] font-mono uppercase tracking-widest">Layer {i + 1}</p>
                    <p className="text-white text-sm font-bold mt-1">{label}</p>
                    {i < 2 && (
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-white/30 text-lg font-bold z-10">≠</div>
                    )}
                  </div>
                ))}
              </div>

              {/* PIN Entry */}
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-white/50 text-xs font-mono uppercase tracking-widest mb-1">Step 1 of 1</p>
                  <p className="text-white text-sm font-medium">Enter your sovereign 4-digit PIN to sign this authorization</p>
                  <p className="text-white/40 text-xs mt-1">Your RSA private key will be decrypted and used to sign the grant</p>
                </div>

                {/* 4 PIN boxes */}
                <div className="flex justify-center space-x-4">
                  {pin.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={pinRefs[idx]}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handlePinDigit(idx, e.target.value)}
                      onKeyDown={e => handlePinKeyDown(idx, e)}
                      className="w-14 h-14 text-center text-2xl font-bold text-white bg-white/10 border border-white/20 focus:border-white focus:bg-white/20 rounded-xl outline-none transition-all caret-transparent"
                      style={{ letterSpacing: '0.1em' }}
                    />
                  ))}
                </div>

                {pinError && (
                  <div className="flex items-center justify-center space-x-2 text-[#EF4444] text-xs animate-fadeSlideIn">
                    <RiAlertLine className="text-sm shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 text-sm font-medium text-white/60 border border-white/10 rounded-xl hover:border-white/30 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAuthorize}
                  disabled={pinStr.length !== 4}
                  className="flex-[2] py-3 text-sm font-bold text-black bg-white rounded-xl hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                >
                  <RiShieldFlashLine className="text-base" />
                  <span>Authorize &amp; Sign with RSA</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE: SIGNING ANIMATION ───────────────────────── */}
        {phase === 'signing' && (
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Animated progress bar */}
            <div className="h-1 bg-white/5">
              <div
                className="h-full bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500 transition-all duration-[700ms] ease-linear"
                style={{ width: `${(signingStep / 6) * 100}%` }}
              />
            </div>

            <div className="p-8">
              {/* Central animated icon */}
              <div className="flex flex-col items-center mb-8 relative">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <SpinningRing size="96px" duration="3" color="#6366f1" opacity={0.6} />
                  <SpinningRing size="72px" duration="2" color="#8b5cf6" opacity={0.5} />
                  <div className="relative z-10 p-4 bg-white/5 border border-white/20 rounded-full">
                    {isSigningComplete
                      ? <RiCheckboxCircleFill className="text-emerald-400 text-4xl" />
                      : <RiShieldFlashLine className="text-white text-4xl animate-pulse" />
                    }
                  </div>
                </div>
                <p className="text-white text-sm font-bold mt-4">
                  {isSigningComplete ? 'Authorization Complete' : 'RSA Digital Signature in Progress...'}
                </p>
                <p className="text-white/40 text-xs mt-1 font-mono">
                  {isSigningComplete ? 'Grant sealed with patient sovereign key' : `Processing step ${signingStep} of 6`}
                </p>
              </div>

              {/* Step list */}
              <div className="space-y-3">
                {CRYPTO_STEPS.map((step) => {
                  const isActive = signingStep === step.id;
                  const isDone = signingStep > step.id || completedSteps.includes(step.id);
                  const isPending = signingStep < step.id;
                  const StepIcon = step.icon;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center space-x-4 p-3.5 rounded-xl border transition-all duration-300 ${
                        isDone
                          ? 'bg-white/5 border-white/10 opacity-70'
                          : isActive
                          ? 'bg-white/10 border-white/20'
                          : 'bg-transparent border-transparent opacity-30'
                      }`}
                    >
                      {/* Step number */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold font-mono"
                        style={{
                          backgroundColor: isDone || isActive ? `${step.color}22` : 'transparent',
                          color: isDone || isActive ? step.color : '#ffffff40',
                          border: `1px solid ${isDone || isActive ? step.color + '40' : '#ffffff10'}`
                        }}
                      >
                        {step.id}
                      </div>

                      {/* Icon */}
                      <StepIcon
                        className="text-xl shrink-0"
                        style={{ color: isDone || isActive ? step.color : '#ffffff30' }}
                      />

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${isDone || isActive ? 'text-white' : 'text-white/30'}`}>
                          {step.title}
                        </p>
                        <p className="text-[10px] font-mono text-white/30 truncate">
                          {isDone ? step.done : step.detail}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="shrink-0">
                        {isDone ? (
                          <RiCheckLine className="text-emerald-400 text-base" />
                        ) : isActive ? (
                          <RiLoader4Line className="text-violet-400 text-base animate-spin" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-white/20" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE: SUCCESS ─────────────────────────────────── */}
        {phase === 'success' && (
          <div className="bg-[#0A0A0A] border border-emerald-500/30 rounded-2xl overflow-hidden shadow-2xl text-center">
            {/* Full-width success bar */}
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-green-400" />

            <div className="p-10 flex flex-col items-center space-y-5">
              {/* Big checkmark */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <SpinningRing size="96px" duration="8" color="#10b981" opacity={0.4} />
                <div className="relative z-10 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                  <RiCheckboxCircleFill className="text-emerald-400 text-5xl" />
                </div>
              </div>

              <div>
                <p className="text-emerald-400 text-[10px] font-mono uppercase tracking-widest mb-2">Authorization Sealed</p>
                <h2 className="text-white text-2xl font-bold">Access Granted</h2>
                <p className="text-white/50 text-sm mt-2">
                  <span className="text-white font-medium">{request.org_name}</span> has been cryptographically authorized
                </p>
              </div>

              {/* Scope summary */}
              <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono uppercase tracking-widest">Approved Scope</span>
                  <span className="text-emerald-400 font-mono text-[10px]">STRICTLY BOUNDED</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(request.data_categories || []).map(cat => (
                    <span key={cat} className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full capitalize">
                      {cat.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                {approvalResult?.expires_at && (
                  <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-white/10">
                    <span className="text-white/40">Grant expires:</span>
                    <span className="text-white/70">{new Date(approvalResult.expires_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <p className="text-white/30 text-xs font-mono">
                Identity ≠ Authorization ≠ Access · Zero-Trust Enforced
              </p>

              <button
                onClick={onClose}
                className="w-full py-3 text-sm font-bold text-black bg-white rounded-xl hover:bg-white/90 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── PHASE: ERROR ───────────────────────────────────── */}
        {phase === 'error' && (
          <div className="bg-[#0A0A0A] border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl text-center">
            <div className="h-1.5 bg-red-500" />
            <div className="p-10 flex flex-col items-center space-y-5">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full">
                <RiAlertLine className="text-red-400 text-5xl" />
              </div>
              <div>
                <h2 className="text-white text-xl font-bold">Authorization Failed</h2>
                <p className="text-white/50 text-sm mt-2">{errorMsg}</p>
              </div>
              <div className="flex space-x-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 text-sm font-medium text-white/60 border border-white/10 rounded-xl hover:border-white/30 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setPhase('pin'); setPin(['', '', '', '']); setErrorMsg(''); }}
                  className="flex-1 py-3 text-sm font-bold text-black bg-white rounded-xl hover:bg-white/90 transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
