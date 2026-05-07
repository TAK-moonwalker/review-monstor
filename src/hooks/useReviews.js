import { useState, useEffect } from 'react';
import { subscribeReviews } from '../firebase/reviewService';

export const useReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeReviews(
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
  }, []);

  return { reviews, loading, error };
};
