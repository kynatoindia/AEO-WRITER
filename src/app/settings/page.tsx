import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserProfile } from '@/components/auth/user-profile';
import { PasswordUpdate } from '@/components/auth/password-update';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage your account settings, security, and preferences.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <UserProfile user={user} />
          <PasswordUpdate />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your account details and subscription information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">User ID</label>
                  <p className="text-sm text-gray-900 font-mono">{user.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Account Created</label>
                  <p className="text-sm text-gray-900">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email Verified</label>
                <p className="text-sm text-gray-900">
                  {user.email_confirmed_at ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}