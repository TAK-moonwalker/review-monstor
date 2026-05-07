import { useState, useEffect } from 'react';
import { subscribeSettings } from '../firebase/settingsService';

export const useSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeSettings(
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
  }, []);

  return { settings, loading, error };
};
