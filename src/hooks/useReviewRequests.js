import { useState, useEffect } from 'react';
import { subscribeRequests } from '../firebase/requestService';

export const useReviewRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeRequests((data) => {
      setRequests(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { requests, loading };
};
