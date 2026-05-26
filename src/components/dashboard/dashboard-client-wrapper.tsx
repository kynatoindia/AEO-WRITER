'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '@supabase/supabase-js';

// dynamic with ssr:false must live in a Client Component (App Router rule)
const DashboardContentDynamic = dynamic(
  () => import('./dashboard-content').then(m => m.DashboardContent),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    ),
  }
);

interface Props {
  user: User;
  initialProjects: any[];
}

export function DashboardClientWrapper({ user, initialProjects }: Props) {
  return <DashboardContentDynamic user={user} initialProjects={initialProjects} />;
}
