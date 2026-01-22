import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { createClient } from '@/lib/supabase/client';
import { UserQuotas } from './use-quota';

export interface RealtimeQuotaUpdate {
  userId: string;
  quotaType: 'tokens' | 'projects' | 'cost';
  oldValue: number;
  newValue: number;
  timestamp: string;
}

export function useRealtimeQuota() {
  const { user } = useAuth();
  const [quotaUpdates, setQuotaUpdates] = useState<RealtimeQuotaUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Subscribe to real-time quota updates
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    
    // Subscribe to user profile changes for quota updates
    const profileChannel = supabase
      .channel(`user_profile_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const { old: oldRecord, new: newRecord } = payload;
          
          // Track token usage changes
          if (oldRecord.tokens_used !== newRecord.tokens_used) {
            const update: RealtimeQuotaUpdate = {
              userId: user.id,
              quotaType: 'tokens',
              oldValue: oldRecord.tokens_used,
              newValue: newRecord.tokens_used,
              timestamp: new Date().toISOString(),
            };
            
            setQuotaUpdates(prev => [...prev.slice(-9), update]); // Keep last 10 updates
            setLastUpdate(new Date());
          }
          
          // Track project usage changes
          if (oldRecord.projects_used !== newRecord.projects_used) {
            const update: RealtimeQuotaUpdate = {
              userId: user.id,
              quotaType: 'projects',
              oldValue: oldRecord.projects_used,
              newValue: newRecord.projects_used,
              timestamp: new Date().toISOString(),
            };
            
            setQuotaUpdates(prev => [...prev.slice(-9), update]);
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Subscribe to usage analytics for cost updates
    const analyticsChannel = supabase
      .channel(`usage_analytics_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'usage_analytics',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newRecord = payload.new;
          
          if (newRecord.cost_usd && newRecord.cost_usd > 0) {
            const update: RealtimeQuotaUpdate = {
              userId: user.id,
              quotaType: 'cost',
              oldValue: 0, // We don't have the old total cost here
              newValue: newRecord.cost_usd,
              timestamp: new Date().toISOString(),
            };
            
            setQuotaUpdates(prev => [...prev.slice(-9), update]);
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      profileChannel.unsubscribe();
      analyticsChannel.unsubscribe();
    };
  }, [user]);

  // Clear quota updates
  const clearUpdates = useCallback(() => {
    setQuotaUpdates([]);
  }, []);

  // Get recent updates for a specific quota type
  const getUpdatesForType = useCallback((quotaType: RealtimeQuotaUpdate['quotaType']) => {
    return quotaUpdates.filter(update => update.quotaType === quotaType);
  }, [quotaUpdates]);

  // Calculate total usage change since last check
  const getUsageChange = useCallback((quotaType: RealtimeQuotaUpdate['quotaType']) => {
    const updates = getUpdatesForType(quotaType);
    if (updates.length === 0) return 0;
    
    const firstUpdate = updates[0];
    const lastUpdate = updates[updates.length - 1];
    
    return lastUpdate.newValue - firstUpdate.oldValue;
  }, [getUpdatesForType]);

  return {
    quotaUpdates,
    isConnected,
    lastUpdate,
    clearUpdates,
    getUpdatesForType,
    getUsageChange,
    hasRecentUpdates: quotaUpdates.length > 0,
    recentUpdateCount: quotaUpdates.length,
  };
}

// Hook for real-time quota notifications
export function useQuotaNotifications() {
  const { quotaUpdates } = useRealtimeQuota();
  const [notifications, setNotifications] = useState<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
    dismissed: boolean;
  }[]>([]);

  useEffect(() => {
    const latestUpdate = quotaUpdates[quotaUpdates.length - 1];
    if (!latestUpdate) return;

    // Create notifications based on quota updates
    let notification = null;
    
    if (latestUpdate.quotaType === 'tokens') {
      const usage = latestUpdate.newValue;
      if (usage > 8000) { // 80% of free plan limit
        notification = {
          id: `token-warning-${Date.now()}`,
          type: 'warning' as const,
          message: `You've used ${usage.toLocaleString()} tokens this month. Consider upgrading your plan.`,
          timestamp: new Date(),
          dismissed: false,
        };
      }
    }
    
    if (latestUpdate.quotaType === 'projects') {
      const usage = latestUpdate.newValue;
      if (usage >= 3) { // Free plan limit
        notification = {
          id: `project-warning-${Date.now()}`,
          type: 'error' as const,
          message: `You've reached your project limit. Upgrade to create more projects.`,
          timestamp: new Date(),
          dismissed: false,
        };
      }
    }
    
    if (latestUpdate.quotaType === 'cost') {
      const cost = latestUpdate.newValue;
      if (cost > 4.0) { // 80% of free plan cost limit
        notification = {
          id: `cost-warning-${Date.now()}`,
          type: 'warning' as const,
          message: `You've spent $${cost.toFixed(2)} this month. You're approaching your limit.`,
          timestamp: new Date(),
          dismissed: false,
        };
      }
    }
    
    if (notification) {
      setNotifications(prev => [...prev.slice(-4), notification!]); // Keep last 5 notifications
    }
  }, [quotaUpdates]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, dismissed: true } : notif
      )
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const activeNotifications = notifications.filter(n => !n.dismissed);

  return {
    notifications: activeNotifications,
    allNotifications: notifications,
    dismissNotification,
    clearAllNotifications,
    hasActiveNotifications: activeNotifications.length > 0,
  };
}