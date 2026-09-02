import React from 'react';
import { useAuth } from '../lib/auth';
import { RiBellLine } from 'react-icons/ri';

export default function TopBar({ breadcrumb = 'Overview' }) {
  const { user } = useAuth();
  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'RX';

  return (
    <header className="h-16 fixed top-0 left-[240px] right-0 bg-white border-b border-black px-8 flex items-center justify-between z-20">
      {/* Top Left: Main Application Brand */}
      <div className="flex items-center space-x-3">
        <h1 className="text-base font-bold tracking-tight text-[#0A0A0A]">
          RxVault Platform
        </h1>
        {user.share_code && (
          <span className="hidden sm:inline-block px-2.5 py-0.5 bg-gray-50 border border-black rounded-full text-[11px] font-mono font-medium text-[#0A0A0A]">
            Code: {user.share_code}
          </span>
        )}
      </div>

      {/* Top Right: Notification Bell and User Profile Avatar matching Image 2 */}
      <div className="flex items-center space-x-5">
        <button className="text-[#0A0A0A] hover:text-[#555555] p-1.5 transition-colors relative">
          <RiBellLine className="text-lg" />
          <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full absolute top-1 right-1" />
        </button>

        {/* User Pill matching Image 2 */}
        <div className="flex items-center space-x-2.5 pl-2">
          <div className="text-right leading-tight">
            <span className="text-xs font-semibold text-[#0A0A0A] block truncate max-w-[120px]">
              {user.name}
            </span>
            <span className="text-[10px] text-[#EF4444] font-medium block uppercase tracking-wider">
              {user.role}
            </span>
          </div>

          <div className="w-8 h-8 rounded-full border border-black bg-gray-50 flex items-center justify-center font-bold text-xs text-[#0A0A0A] font-mono">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
