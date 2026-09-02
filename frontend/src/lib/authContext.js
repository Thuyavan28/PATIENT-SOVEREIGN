import { createContext } from 'react';

// Exported separately so Vite HMR can fast-refresh auth.jsx without breaking context
export const AuthContext = createContext(null);
