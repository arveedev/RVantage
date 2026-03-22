import React, { createContext, useMemo } from 'react';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';

interface User {
  id: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

// Internal context object
const InternalAuthContext = createContext<AuthContextType | undefined>(undefined);

// Export the Context object specifically for the useAuth hook to consume
export const AuthContext = InternalAuthContext;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // We sync directly with the session table
  const session = useLiveQuery(() => db.session.get('current'));
  
  // We fetch the user details based on the session user_id
  const userData = useLiveQuery(
    async () => {
      if (!session?.user_id) return null;
      return await db.users.get(session.user_id);
    },
    [session?.user_id]
  );

  // The context is "loading" only while Dexie is still resolving the initial query
  const contextValue = useMemo(() => ({
    user: userData ? { id: userData.id, username: userData.username } : null,
    loading: session === undefined || (!!session?.user_id && userData === undefined)
  }), [session, userData]);

  return (
    <InternalAuthContext.Provider value={contextValue}>
      {children}
    </InternalAuthContext.Provider>
  );
}