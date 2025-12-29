import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserNav } from '@/components/auth/user-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AEO Writer Pro</h1>
            </div>
            <UserNav />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-2">
            Welcome back! Here's an overview of your content projects.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Projects</CardTitle>
              <CardDescription>All your content projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-muted-foreground">No projects yet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Projects</CardTitle>
              <CardDescription>Currently in progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-muted-foreground">No active projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Completed Projects</CardTitle>
              <CardDescription>Successfully finished</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-muted-foreground">No completed projects</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>
                Create your first AI-powered SEO content project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Welcome to AEO Writer Pro! You're now authenticated and ready to start creating 
                high-quality, SEO-optimized content using AI. Your authentication system is 
                working correctly.
              </p>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  <strong>User ID:</strong> {user.id}
                </p>
                <p className="text-sm text-gray-500">
                  <strong>Email:</strong> {user.email}
                </p>
                <p className="text-sm text-gray-500">
                  <strong>Email Verified:</strong> {user.email_confirmed_at ? 'Yes' : 'No'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}