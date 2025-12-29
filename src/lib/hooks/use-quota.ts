import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  resetDate: string;
}

export interface UserQuotas {
  plan: 'free' | 'pro' | 'enterprise';
  resetDate: string;
  quotas: {
    contentGeneration: QuotaInfo;
    apiCalls: QuotaInfo;
    projects: QuotaInfo;
    tokensPerMonth: QuotaInfo;
    costLimitUsd: QuotaInfo;
  };
  planLimits: {
    contentGeneration: number;
    apiCalls: number;
    projects: number;
    tokensPerMonth: number;
    costLimitUsd: number;
  };
  isNearLimit: {
    contentGeneration: boolean;
    apiCalls: boolean;
    projects: boolean;
    tokensPerMonth: boolean;
    costLimitUsd: boolean;
  };
}

export function useQuota() {
  const { user } = useAuth();
  const [quotas, setQuotas] = useState<UserQuotas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotas = useCallback(async () => {
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
  }, [user]);

  // Refresh quota cache on server
  const refreshQuotas = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/user/quota', {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchQuotas(); // Fetch updated data
      }
    } catch (err) {
      console.error('Failed to refresh quotas:', err);
    }
  }, [user, fetchQuotas]);

  useEffect(() => {
    fetchQuotas();
  }, [fetchQuotas]);

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

  const getRemainingDays = (type: keyof UserQuotas['quotas']): number => {
    const quota = quotas?.quotas[type];
    if (!quota) return 0;
    
    const resetDate = new Date(quota.resetDate);
    const now = new Date();
    const diffTime = resetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  const getQuotaStatus = (type: keyof UserQuotas['quotas']): 'healthy' | 'warning' | 'critical' | 'exceeded' => {
    const quota = quotas?.quotas[type];
    if (!quota) return 'healthy';
    
    if (!quota.allowed) return 'exceeded';
    
    const percentage = getUsagePercentage(type);
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'healthy';
  };

  const formatCost = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    if (num === -1) return 'Unlimited';
    return new Intl.NumberFormat('en-US').format(num);
  };

  return {
    quotas,
    loading,
    error,
    refetch: fetchQuotas,
    refreshQuotas,
    checkQuota,
    getUsagePercentage,
    isNearLimit,
    getRemainingDays,
    getQuotaStatus,
    formatCost,
    formatNumber,
    // Convenience getters
    canCreateProject: checkQuota('projects'),
    canGenerateContent: checkQuota('contentGeneration'),
    canMakeApiCall: checkQuota('apiCalls'),
    hasTokensRemaining: checkQuota('tokensPerMonth'),
    isWithinCostLimit: checkQuota('costLimitUsd'),
  };
}