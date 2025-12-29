'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const [supabase] = useState(() => createClientSupabaseClient());

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push(redirectTo);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, redirectTo]);

  return (
    <div className="bg-white py-8 px-6 shadow rounded-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 text-center">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link
            href="/auth/register"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            create a new account
          </Link>
        </p>
      </div>

      <Auth
        supabaseClient={supabase}
        view="sign_in"
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#2563eb',
                brandAccent: '#1d4ed8',
              },
            },
          },
          className: {
            container: 'auth-container',
            button: 'auth-button',
            input: 'auth-input',
          },
        }}
        providers={[]}
        redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=${encodeURIComponent(redirectTo)}`}
        onlyThirdPartyProviders={false}
        magicLink={false}
        showLinks={false}
      />

      <div className="mt-6 text-center">
        <Link
          href="/auth/forgot-password"
          className="text-sm text-blue-600 hover:text-blue-500"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bg-white py-8 px-6 shadow rounded-lg">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}