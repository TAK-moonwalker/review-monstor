import { useState, useEffect } from 'react';
import { subscribeAuthState } from '../firebase/authService';

export const useAuth = () => {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = subscribeAuthState(setUser);
    return () => unsubscribe();
  }, []);

  return { user, loading: user === undefined };
};
