'use client';

import { useQuota } from '@/lib/hooks/use-quota';
import { useRealtimeQuota, useQuotaNotifications } from '@/lib/hooks/use-realtime-quota';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Wifi, WifiOff, Bell, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export function QuotaDisplay() {
  const { 
    quotas, 
    loading, 
    error, 
    refreshQuotas,
    getUsagePercentage, 
    getQuotaStatus,
    formatCost,
    formatNumber,
    getRemainingDays,
  } = useQuota();
  
  const { 
    isConnected, 
    lastUpdate, 
    hasRecentUpdates,
    getUsageChange 
  } = useRealtimeQuota();
  
  const { 
    notifications, 
    dismissNotification, 
    hasActiveNotifications 
  } = useQuotaNotifications();
  
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshQuotas();
    setRefreshing(false);
  };

  // Auto-refresh when real-time updates are received
  useEffect(() => {
    if (hasRecentUpdates && lastUpdate) {
      const timeSinceUpdate = Date.now() - lastUpdate.getTime();
      if (timeSinceUpdate < 5000) { // If update was within last 5 seconds
        refreshQuotas();
      }
    }
  }, [hasRecentUpdates, lastUpdate, refreshQuotas]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage & Quotas</CardTitle>
          <CardDescription>Loading your usage information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-white/10 rounded-lg animate-pulse" />
                <div className="h-2 bg-white/5 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Quotas</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!quotas) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
      case 'exceeded':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-orange-500';
      case 'exceeded':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const quotaItems = [
    {
      key: 'contentGeneration',
      label: 'Content Generation',
      description: 'Blog posts and articles generated',
      quota: quotas.quotas.contentGeneration,
    },
    {
      key: 'projects',
      label: 'Projects',
      description: 'Active projects in your account',
      quota: quotas.quotas.projects,
    },
    {
      key: 'tokensPerMonth',
      label: 'AI Tokens',
      description: 'Monthly AI processing tokens',
      quota: quotas.quotas.tokensPerMonth,
    },
    {
      key: 'costLimitUsd',
      label: 'Monthly Cost',
      description: 'AI service costs this month',
      quota: quotas.quotas.costLimitUsd,
      isCost: true,
    },
    {
      key: 'apiCalls',
      label: 'API Calls',
      description: 'Daily API request limit',
      quota: quotas.quotas.apiCalls,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Real-time notifications */}
      {hasActiveNotifications && (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-xl border flex items-center justify-between ${
                notification.type === 'error'
                  ? 'bg-destructive/10 border-destructive/20 text-destructive'
                  : notification.type === 'warning'
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  : 'bg-primary/10 border-primary/20 text-primary'
              }`}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="text-sm">{notification.message}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissNotification(notification.id)}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Usage & Quotas
              <Badge variant="outline" className="capitalize">
                {quotas.plan} Plan
              </Badge>
              {/* Real-time connection indicator */}
              <div className="flex items-center gap-1">
                {isConnected ? (
                  <Wifi className="w-3 h-3 text-green-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </CardTitle>
            <CardDescription>
              Your current usage and limits. Resets on {new Date(quotas.resetDate).toLocaleDateString()}
              {lastUpdate && (
                <span className="block text-xs text-green-600 mt-1">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </CardDescription>
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="ghost" 
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {quotaItems.map((item) => {
              const status = getQuotaStatus(item.key as any);
              const percentage = getUsagePercentage(item.key as any);
              const quota = item.quota;
              const recentChange = getUsageChange(
                item.key === 'tokensPerMonth' ? 'tokens' : 
                item.key === 'projects' ? 'projects' : 
                item.key === 'costLimitUsd' ? 'cost' : 'tokens'
              );
              
              return (
                <div key={item.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <div>
                        <p className="font-medium text-sm flex items-center gap-2">
                          {item.label}
                          {recentChange > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              +{item.isCost ? formatCost(recentChange) : formatNumber(recentChange)}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {item.isCost ? formatCost(quota.used) : formatNumber(quota.used)} / {' '}
                        {item.isCost ? formatCost(quota.limit) : formatNumber(quota.limit)}
                      </p>
                      {quota.limit > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(quota.remaining)} remaining
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {quota.limit > 0 && (
                    <div className="space-y-1">
                      <Progress 
                        value={percentage} 
                        className="h-2"
                        // Custom progress bar color based on status
                        style={{
                          '--progress-background': getStatusColor(status),
                        } as any}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{percentage.toFixed(1)}% used</span>
                        {item.key === 'apiCalls' ? (
                          <span>Resets tomorrow</span>
                        ) : (
                          <span>{getRemainingDays(item.key as any)} days until reset</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {status === 'exceeded' && (
                    <div className="status-error-modern rounded-xl p-2">
                      <p className="text-xs">
                        Limit exceeded. {item.key === 'projects' ? 'Upgrade your plan to create more projects.' : 'Usage will reset on the next billing cycle.'}
                      </p>
                    </div>
                  )}

                  {status === 'critical' && (
                    <div className="status-warning-modern rounded-xl p-2">
                      <p className="text-xs">
                        You&apos;re approaching your limit. Consider upgrading your plan.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Plan upgrade suggestion */}
            {quotas.plan === 'free' && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <p className="font-semibold text-sm text-foreground">Upgrade to Pro</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Get 50x more content generation, 500K tokens, and 50 projects for just $29/month.
                </p>
                <Button size="sm">
                  Upgrade Now
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}