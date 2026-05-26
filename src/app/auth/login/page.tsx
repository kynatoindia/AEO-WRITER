'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const [supabase] = useState(() => createClient());

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
    <div className="glass-card py-8 px-6 rounded-2xl border border-white/10 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground text-center">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Or{' '}
          <Link
            href="/auth/register"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
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
                brand: 'hsl(260 85% 65%)',
                brandAccent: 'hsl(260 85% 55%)',
                inputBackground: 'hsl(220 25% 10%)',
                inputBorder: 'hsl(220 20% 20%)',
                inputBorderFocus: 'hsl(260 85% 65%)',
                inputText: 'hsl(220 15% 95%)',
                inputPlaceholder: 'hsl(220 10% 50%)',
                defaultButtonBackground: 'hsl(220 25% 12%)',
                defaultButtonBackgroundHover: 'hsl(220 25% 15%)',
                defaultButtonBorder: 'hsl(220 20% 20%)',
                defaultButtonText: 'hsl(220 15% 90%)',
                dividerBackground: 'hsl(220 20% 15%)',
                messageText: 'hsl(220 15% 90%)',
                messageBackground: 'hsl(220 25% 10%)',
                messageBorder: 'hsl(220 20% 20%)',
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
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="glass-card py-8 px-6 rounded-2xl border border-white/10">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
