import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { subscribeReviewRequests } from '../firebase/requestService';

export const useReviewRequests = () => {
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const unsubscribe = subscribeReviewRequests(
      user.uid,
      (data) => {
        setRequests(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user, authLoading]);

  return { requests, loading: authLoading || loading, error };
};
