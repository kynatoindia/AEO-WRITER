'use client';

import { useState } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { User } from '@supabase/supabase-js';

interface UserProfileProps {
  user: User;
}

export function UserProfile({ user }: UserProfileProps) {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '');
  const [email, setEmail] = useState(user.email || '');
  const supabase = createClientSupabaseClient();

  const updateProfile = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });

      if (error) {
        throw error;
      }

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  const updateEmail = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        email: email,
      });

      if (error) {
        throw error;
      }

      toast.success('Email update initiated. Please check your new email for confirmation.');
    } catch (error) {
      console.error('Error updating email:', error);
      toast.error('Error updating email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <Button onClick={updateProfile} disabled={loading}>
            {loading ? 'Updating...' : 'Update Profile'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Address</CardTitle>
          <CardDescription>
            Change your email address. You'll need to confirm the new email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <Button 
            onClick={updateEmail} 
            disabled={loading || email === user.email}
            variant="outline"
          >
            {loading ? 'Updating...' : 'Update Email'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}