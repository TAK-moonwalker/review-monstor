import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { subscribeSettings } from '../firebase/settingsService';

export const useSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const unsubscribe = subscribeSettings(
      user.uid,
      (data) => {
        setSettings(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [user, authLoading]);

  return { settings, loading: authLoading || (!!user && loading), error };
};
