import { useContext } from 'react';
import { AuthContext } from './authContext';

// Re-export AuthProvider for convenience (used in main.jsx)
export { AuthProvider } from './AuthProvider';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
