import React from 'react';
import {
  RiDashboardLine,
  RiHospitalLine,
  RiHealthBookLine,
  RiFolderLine,
  RiBellLine,
  RiShieldCheckLine,
  RiUserLine,
  RiSearchLine,
  RiSendPlaneLine,
  RiAlertLine,
  RiBuildingLine,
  RiFileListLine,
  RiBarChartLine,
  RiArrowLeftSLine,
  RiLogoutBoxRLine
} from 'react-icons/ri';
import { useAuth } from '../lib/auth';

export default function Sidebar({ currentTab, setTab, pendingCount = 0 }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  let navItems = [];

  if (user.role === 'patient') {
    navItems = [
      { id: 'overview', label: 'Dashboard', icon: RiDashboardLine },
      { id: 'vault', label: 'Health Vault', icon: RiHospitalLine },
      { id: 'prescriptions', label: 'Prescription Ledger', icon: RiHealthBookLine },
      { id: 'documents', label: 'Medical Documents', icon: RiFolderLine },
      {
        id: 'requests',
        label: 'Access Requests',
        icon: RiBellLine,
        badge: pendingCount > 0 ? pendingCount : null
      },
      { id: 'audit', label: 'Audit Trail', icon: RiShieldCheckLine },
      { id: 'profile', label: 'Settings', icon: RiUserLine }
    ];
  } else if (user.role === 'org') {
    navItems = [
      { id: 'overview', label: 'Dashboard', icon: RiDashboardLine },
      { id: 'find', label: 'Find Patient', icon: RiSearchLine },
      { id: 'requests', label: 'My Requests', icon: RiSendPlaneLine },
      { id: 'fraud', label: 'Fraud Alerts', icon: RiAlertLine }
    ];
  } else if (user.role === 'admin') {
    navItems = [
      { id: 'overview', label: 'Dashboard', icon: RiDashboardLine },
      { id: 'orgs', label: 'Organizations', icon: RiBuildingLine },
      { id: 'audit', label: 'Full Audit Log', icon: RiFileListLine },
      { id: 'fraud', label: 'Fraud Flags', icon: RiAlertLine },
      { id: 'stats', label: 'Analytics', icon: RiBarChartLine }
    ];
  }

  return (
    <aside className="w-[240px] fixed top-0 left-0 bottom-0 bg-white border-r border-black flex flex-col justify-between z-30 select-none font-sans">
      <div>
        {/* Brand Bar */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-black">
          <span className="font-bold font-sans text-base tracking-tight text-[#0A0A0A]">
            RxVault
          </span>
        </div>

        {/* Menu Section Header with collapse chevron */}
        <div className="px-6 pt-5 pb-2 flex items-center justify-between">
          <span className="text-sm font-medium font-sans text-[#0A0A0A]">
            Menu
          </span>
          <button className="text-[#555555] hover:text-[#0A0A0A] p-0.5 rounded transition-colors">
            <RiArrowLeftSLine className="text-lg" />
          </button>
        </div>

        {/* Navigation items: Inter Medium / 500 */}
        <nav className="px-3 py-2 space-y-1 font-sans">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium font-sans transition-all duration-150 ${
                  isActive
                    ? 'border border-black bg-white text-[#0A0A0A] shadow-xs'
                    : 'border border-transparent text-[#555555] hover:text-[#0A0A0A] hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3 font-medium">
                  <Icon className={`text-base ${isActive ? 'text-[#0A0A0A]' : 'text-[#666666]'}`} />
                  <span className="font-medium font-sans">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-[#EF4444] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center font-sans">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-black bg-gray-50/50 font-sans">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-2">
            <div className="text-xs font-medium font-sans text-[#0A0A0A] truncate">
              {user.name}
            </div>
            <div className="text-[10px] font-normal font-sans text-[#777777] uppercase tracking-wider">
              {user.role} {user.org_type ? `• ${user.org_type}` : ''}
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 text-[#555555] hover:text-[#EF4444] hover:bg-white rounded transition-colors"
          >
            <RiLogoutBoxRLine className="text-lg" />
          </button>
        </div>
      </div>
    </aside>
  );
}
