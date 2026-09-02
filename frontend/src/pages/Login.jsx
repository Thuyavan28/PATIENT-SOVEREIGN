import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { RiShieldKeyholeLine, RiArrowRightLine } from 'react-icons/ri';

export default function Login({ onSwitchToRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      // Error handled by toast in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-black text-white rounded-lg font-mono font-bold text-xl mb-3 shadow-sm">
          Rx
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          RxVault
        </h1>
        <p className="text-xs text-[#555555] mt-1 font-medium">
          Patient-Sovereign, Cryptographically-Verified Health Data Exchange
        </p>
      </div>

      {/* Main Login Card */}
      <div className="bg-white border border-black rounded-2xl p-8 max-w-md w-full shadow-none">
        <h2 className="text-base font-semibold text-[#0A0A0A] mb-1">
          Sign In to Your Vault
        </h2>
        <p className="text-xs text-[#555555] mb-6">
          Access your cryptographic health records or organization portal.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="e.g. rahul@patient.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-black"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-black"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#000000] text-white rounded-xl py-2.5 text-xs font-semibold hover:bg-[#333333] transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <RiArrowRightLine className="text-base" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-[#555555]">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-[#0A0A0A] font-semibold underline hover:text-black"
            >
              Create Vault / Register
            </button>
          </p>
        </div>
      </div>

      {/* Hackathon Demo Quick Switcher */}
      <div className="mt-6 max-w-md w-full bg-white border border-black rounded-2xl p-5 text-xs">
        <span className="font-semibold text-[#0A0A0A] block mb-2 font-mono uppercase tracking-wider text-[11px]">
          Demo Quick-Select:
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleQuickFill('rahul@patient.com', 'Patient@123')}
            className="p-2.5 text-left bg-gray-50/50 border border-black rounded-xl hover:border-black transition-colors"
          >
            <span className="font-semibold text-[#0A0A0A] block text-xs">1. Patient (Rahul)</span>
            <span className="text-[10px] text-[#555555] font-mono">Code: A1B2C3 • PIN: 1234</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill('citycare@hospital.com', 'Hospital@123')}
            className="p-2.5 text-left bg-gray-50/50 border border-black rounded-xl hover:border-black transition-colors"
          >
            <span className="font-semibold text-[#0A0A0A] block text-xs">2. Hospital (CityCare)</span>
            <span className="text-[10px] text-[#555555] font-mono">Unverified Org</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill('metro@pharmacy.com', 'Pharmacy@123')}
            className="p-2.5 text-left bg-gray-50/50 border border-black rounded-xl hover:border-black transition-colors"
          >
            <span className="font-semibold text-[#0A0A0A] block text-xs">3. Pharmacy (Metro)</span>
            <span className="text-[10px] text-[#555555] font-mono">Verified Org</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill('admin@rxvault.com', 'Admin@123')}
            className="p-2.5 text-left bg-gray-50/50 border border-black rounded-xl hover:border-black transition-colors"
          >
            <span className="font-semibold text-[#0A0A0A] block text-xs">4. System Admin</span>
            <span className="text-[10px] text-[#555555] font-mono">Verification & Audit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
