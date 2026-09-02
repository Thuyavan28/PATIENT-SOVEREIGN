import React, { useState } from 'react';
import { RiFileCopyLine, RiCheckLine, RiShieldKeyholeLine } from 'react-icons/ri';
import { toast } from '../lib/toast';

export default function ShareCodeDisplay({ shareCode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!shareCode) return;
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    toast.success('Share code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!shareCode) return null;

  return (
    <div className="bg-white border-2 border-[#000000] rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-[#555555]">
          <RiShieldKeyholeLine className="text-sm text-[#0A0A0A]" />
          <span>Health Share Code</span>
        </div>
        <span className="text-[10px] font-medium bg-black text-white px-2 py-0.5 rounded">
          Sovereign Identifier
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-3xl font-mono font-bold tracking-widest text-[#0A0A0A]">
          {shareCode}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 text-xs font-medium bg-[#000000] text-white px-3 py-2 rounded-md hover:bg-[#333333] transition-colors"
        >
          {copied ? (
            <>
              <RiCheckLine className="text-sm text-[#16A34A]" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <RiFileCopyLine className="text-sm" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      <p className="mt-3 text-xs text-[#555555] leading-relaxed">
        Knowing your share code does not grant medical data access. Healthcare organizations must request authorization, which requires your explicit 4-digit cryptographic PIN approval.
      </p>
    </div>
  );
}
