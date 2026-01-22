import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserNav } from '@/components/auth/user-nav';
import { DashboardContent } from '@/components/dashboard/dashboard-content';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch user's projects
  const { data: projects = [] } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen relative">
      {/* Enhanced Dark Blue Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full dark-blue-gradient" />
        <div className="absolute top-[20%] right-[10%] w-96 h-96 bg-gradient-to-br from-blue-600/15 via-indigo-700/10 to-transparent blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[20%] left-[10%] w-80 h-80 bg-gradient-to-tl from-purple-600/15 via-violet-700/10 to-transparent blur-[100px] rounded-full animate-pulse delay-1000" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-primary/8 to-transparent blur-[80px] rounded-full animate-pulse-slow" />
      </div>

      <header className="glass-card border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-purple-600/10 border border-white/10">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg" />
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
        <DashboardContent user={user} initialProjects={projects || []} />
      </main>
    </div>
  );
}