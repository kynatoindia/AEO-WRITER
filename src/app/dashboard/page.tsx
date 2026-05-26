import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserNav } from '@/components/auth/user-nav';
import { DashboardClientWrapper } from '@/components/dashboard/dashboard-client-wrapper';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: projects = [] } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen relative">
      <header className="glass-card border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <div className="w-8 h-8 bg-primary rounded-lg" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient-primary">AEO Writer Pro</h1>
                <p className="text-sm text-muted-foreground">AI Content Intelligence</p>
              </div>
            </div>
            <UserNav />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <DashboardClientWrapper user={user} initialProjects={(projects || []) as any} />
      </main>
    </div>
  );
}
