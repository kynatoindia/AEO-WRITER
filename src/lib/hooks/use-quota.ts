import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
}

export interface UserQuotas {
  plan: 'free' | 'pro' | 'enterprise';
  quotas: {
    contentGeneration: QuotaInfo;
    apiCalls: QuotaInfo;
    projects: QuotaInfo;
  };
}

export function useQuota() {
  const { user } = useAuth();
  const [quotas, setQuotas] = useState<UserQuotas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotas = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/quota');
      
      if (!response.ok) {
        throw new Error('Failed to fetch quotas');
      }

      const data = await response.json();
      setQuotas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotas();
  }, [user]);

  const checkQuota = (type: keyof UserQuotas['quotas']): boolean => {
    return quotas?.quotas[type]?.allowed ?? false;
  };

  const getUsagePercentage = (type: keyof UserQuotas['quotas']): number => {
    const quota = quotas?.quotas[type];
    if (!quota || quota.limit === -1) return 0;
    return Math.min((quota.used / quota.limit) * 100, 100);
  };

  const isNearLimit = (type: keyof UserQuotas['quotas'], threshold = 80): boolean => {
    return getUsagePercentage(type) >= threshold;
  };

  return {
    quotas,
    loading,
    error,
    refetch: fetchQuotas,
    checkQuota,
    getUsagePercentage,
    isNearLimit,
  };
}