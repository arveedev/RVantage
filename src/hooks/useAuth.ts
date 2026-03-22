import { useContext } from 'react';
import { AuthContext } from '../components/AuthContext';

/**
 * useAuth Hook
 * Provides access to the current authenticated user and the loading state
 * of the authentication sync process.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  // Guard clause to ensure the hook is used within the correct provider scope
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};