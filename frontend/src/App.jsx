import React, { useState } from 'react';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import OrgDashboard from './pages/OrgDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ToastContainer from './components/ToastContainer';

export default function App() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-black border-gray-200 animate-spin" />
          <span className="text-xs font-mono text-[#555555]">Initializing RxVault...</span>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <>
        {authView === 'login' ? (
          <Login onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <Register
            onSwitchToLogin={() => setAuthView('login')}
            onRegistered={() => setAuthView('login')}
          />
        )}
        <ToastContainer />
      </>
    );
  }

  // Authenticated Role-based views
  return (
    <>
      {user.role === 'patient' && <PatientDashboard />}
      {user.role === 'org' && <OrgDashboard />}
      {user.role === 'admin' && <AdminDashboard />}
      <ToastContainer />
    </>
  );
}
