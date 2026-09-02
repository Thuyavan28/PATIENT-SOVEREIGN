import React, { useState } from 'react';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import OrgDashboard from './pages/OrgDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ToastContainer from './components/ToastContainer';

import Loader from './components/Loader';

export default function App() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  if (loading) {
    return (
      <Loader
        fullScreen={true}
        message="Initializing RxVault Security Environment..."
        subtitle="Connecting to Neon Cloud Database & Validating RSA Keyrings"
      />
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
