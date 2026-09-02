import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  RiUserLine,
  RiBuildingLine,
  RiArrowRightLine,
  RiShieldKeyholeLine
} from 'react-icons/ri';
import PinInput from '../components/PinInput';
import ShareCodeDisplay from '../components/ShareCodeDisplay';

export default function Register({ onSwitchToLogin, onRegistered }) {
  const { register } = useAuth();

  const [role, setRole] = useState('patient'); // 'patient' | 'org'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgType, setOrgType] = useState('hospital');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Success state showing sovereign Share Code
  const [createdPatient, setCreatedPatient] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (pin.length !== 4) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }
    setPinError(false);
    setLoading(true);

    try {
      const user = await register({
        name,
        email,
        password,
        role,
        org_type: role === 'org' ? orgType : null,
        pin
      });

      if (user.role === 'patient') {
        setCreatedPatient(user);
      } else {
        if (onRegistered) onRegistered();
      }
    } catch (err) {
      // Handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  // If patient successfully registered, reveal the sovereign share code card
  if (createdPatient) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full space-y-6 animate-fadeSlideIn">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 text-[#16A34A] border border-green-200 rounded-full text-2xl mb-2">
              <RiShieldKeyholeLine />
            </div>
            <h2 className="text-xl font-bold text-[#0A0A0A]">
              Sovereign Health Vault Initialized
            </h2>
            <p className="text-xs text-[#555555] mt-1">
              Your 2048-bit RSA cryptographic keypair has been generated and encrypted with your secret PIN.
            </p>
          </div>

          <ShareCodeDisplay shareCode={createdPatient.share_code} />

          <button
            onClick={() => onRegistered && onRegistered()}
            className="w-full bg-[#000000] text-white rounded-md py-3 text-sm font-medium hover:bg-[#333333] transition-colors flex items-center justify-center space-x-2 shadow-sm"
          >
            <span>Proceed to Health Vault Dashboard</span>
            <RiArrowRightLine className="text-base" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4">
      {/* Brand Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-black text-white rounded-lg font-mono font-bold text-xl mb-3 shadow-sm">
          Rx
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          Create Your Sovereign Identity
        </h1>
        <p className="text-xs text-[#555555] mt-1 font-medium">
          Identity ≠ Authorization ≠ Access
        </p>
      </div>

      {/* Main Register Card */}
      <div className="bg-white border border-black rounded-xl p-8 max-w-md w-full shadow-sm">
        {/* Role Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => setRole('patient')}
            className={`flex items-center justify-center space-x-2 py-2 text-xs font-semibold rounded-md transition-all ${
              role === 'patient'
                ? 'bg-white text-[#0A0A0A] shadow-sm'
                : 'text-[#555555] hover:text-[#0A0A0A]'
            }`}
          >
            <RiUserLine className="text-sm" />
            <span>Patient</span>
          </button>

          <button
            type="button"
            onClick={() => setRole('org')}
            className={`flex items-center justify-center space-x-2 py-2 text-xs font-semibold rounded-md transition-all ${
              role === 'org'
                ? 'bg-white text-[#0A0A0A] shadow-sm'
                : 'text-[#555555] hover:text-[#0A0A0A]'
            }`}
          >
            <RiBuildingLine className="text-sm" />
            <span>Organization</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
              {role === 'patient' ? 'Full Legal Name' : 'Organization Name'}
            </label>
            <input
              type="text"
              required
              placeholder={role === 'patient' ? 'e.g. Rahul Sharma' : 'e.g. CityCare Hospital'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder={role === 'patient' ? 'e.g. rahul@patient.com' : 'e.g. contact@citycare.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
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
              className="w-full"
            />
          </div>

          {role === 'org' && (
            <div>
              <label className="block text-xs font-medium text-[#0A0A0A] mb-1">
                Organization Classification
              </label>
              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value)}
                className="w-full"
              >
                <option value="hospital">Hospital / Clinic</option>
                <option value="pharmacy">Pharmacy / Chemist</option>
                <option value="lab">Diagnostic / Pathology Lab</option>
                <option value="insurance">Health Insurance Provider</option>
              </select>
            </div>
          )}

          {/* 4-Digit PIN */}
          <div className="pt-2 border-t border-gray-100 flex flex-col items-center">
            <label className="block text-xs font-semibold text-[#0A0A0A] text-center mb-1">
              4-Digit Sovereign PIN
            </label>
            <p className="text-[11px] text-[#555555] text-center mb-3">
              Your PIN authorizes all medical actions — keep it secret
            </p>
            <PinInput
              value={pin}
              onChange={(p) => {
                setPin(p);
                if (pinError) setPinError(false);
              }}
              error={pinError}
            />
          </div>

          <button
            type="submit"
            disabled={loading || pin.length !== 4}
            className="w-full mt-2 bg-[#000000] text-white rounded-md py-2.5 text-sm font-medium hover:bg-[#333333] transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{loading ? 'Generating Sovereign Keys...' : 'Register & Create Keys'}</span>
            <RiArrowRightLine className="text-base" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-[#555555]">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-[#0A0A0A] font-semibold underline hover:text-black"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
