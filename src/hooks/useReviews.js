import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { subscribeReviews } from '../firebase/reviewService';

export const useReviews = () => {
  const { user, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const unsubscribe = subscribeReviews(
      user.uid,
      (data) => {
        setReviews(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [user, authLoading]);

  return { reviews, loading: authLoading || loading, error };
};
