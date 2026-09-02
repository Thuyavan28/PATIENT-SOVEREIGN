import React from 'react';
import { RiShieldCheckLine, RiErrorWarningLine } from 'react-icons/ri';

export default function IntegrityBadge({ valid = true, label = null }) {
  if (valid) {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-[#16A34A] border border-green-200">
        <RiShieldCheckLine className="text-sm" />
        <span>{label || 'Cryptographically Verified'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-[#EF4444] border border-red-200 animate-pulse">
      <RiErrorWarningLine className="text-sm" />
      <span>{label || 'Tamper Detected'}</span>
    </span>
  );
}
