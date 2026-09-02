import React from 'react';
import { RiShieldCheckLine, RiLockLine } from 'react-icons/ri';

export default function Loader({
  message = 'Verifying Cryptographic Ledger...',
  subtitle = 'RxVault Zero-Trust Protocol',
  fullScreen = false
}) {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 text-center font-sans animate-fadeSlideIn">
      {/* Animated Cryptographic Emblem */}
      <div className="relative flex items-center justify-center w-20 h-20 mb-4">
        {/* Outer Pulsing Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-black/20 animate-ping" />
        
        {/* Spinning Dotted Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-black animate-spin [animation-duration:3s]" />
        
        {/* Center Shield Box */}
        <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center shadow-md relative z-10">
          <RiShieldCheckLine className="text-2xl animate-pulse" />
        </div>
      </div>

      {/* Primary Message: Inter Bold 700 */}
      <h3 className="text-base font-bold font-sans text-[#0A0A0A] tracking-tight">
        {message}
      </h3>

      {/* Subtitle: Inter Regular 400 */}
      <p className="text-xs font-normal font-sans text-[#555555] mt-1 max-w-xs">
        {subtitle}
      </p>

      {/* Live crypto security badge */}
      <div className="mt-4 flex items-center space-x-1.5 px-3 py-1 bg-gray-50 border border-black rounded-full text-[10px] font-mono text-[#0A0A0A]">
        <RiLockLine className="text-xs" />
        <span>SHA-256 • RSA-2048 • ZERO-TRUST</span>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center py-12">
      {content}
    </div>
  );
}
