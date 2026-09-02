import React from 'react';
import { RiShieldCheckLine } from 'react-icons/ri';

/**
 * Loader — matches RxVault theme: white bg, black borders, Inter font
 * 
 * Props:
 *   message    - primary loading text
 *   subtitle   - secondary label
 *   fullScreen - covers entire viewport (fixed inset-0)
 */
export default function Loader({
  message = 'Loading...',
  subtitle = 'Please wait',
  fullScreen = false
}) {
  const content = (
    <div className="flex flex-col items-center justify-center space-y-5 p-10 text-center font-sans">

      {/* ── Animated Icon Stack ── */}
      <div className="relative flex items-center justify-center w-[72px] h-[72px]">

        {/* Outer slow-spin dashed ring */}
        <span
          className="absolute inset-0 rounded-full border border-dashed border-black/30"
          style={{ animation: 'rxSpin 4s linear infinite' }}
        />

        {/* Middle faster spin ring */}
        <span
          className="absolute inset-[8px] rounded-full border border-black/20"
          style={{ animation: 'rxSpin 2s linear infinite reverse' }}
        />

        {/* Inner ping pulse ring */}
        <span className="absolute inset-[18px] rounded-full border border-black/10 animate-ping" />

        {/* Center shield — static anchor */}
        <span className="relative z-10 flex items-center justify-center w-9 h-9 rounded-xl bg-[#0A0A0A] text-white shadow">
          <RiShieldCheckLine className="text-lg" />
        </span>
      </div>

      {/* ── Bouncing dots progress bar ── */}
      <div className="flex items-center space-x-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]"
            style={{
              animation: `rxBounce 1.2s ease-in-out ${i * 0.15}s infinite`
            }}
          />
        ))}
      </div>

      {/* ── Text ── */}
      <div className="space-y-1">
        <p className="text-sm font-bold text-[#0A0A0A] tracking-tight leading-snug">
          {message}
        </p>
        <p className="text-[11px] font-normal text-[#777777]">
          {subtitle}
        </p>
      </div>

      {/* ── Badge ── */}
      <div className="flex items-center space-x-1.5 px-3 py-1 bg-white border border-black rounded-full text-[10px] font-mono text-[#0A0A0A]">
        <span className="w-1.5 h-1.5 rounded-full bg-black inline-block animate-pulse" />
        <span>RSA-2048 · ZERO-TRUST · SHA-256</span>
      </div>

    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center min-h-[280px]">
      {content}
    </div>
  );
}
