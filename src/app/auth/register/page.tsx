'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <div className="glass-card py-8 px-6 rounded-2xl border border-white/10 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground text-center">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Or{' '}
          <Link
            href="/auth/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            sign in to your existing account
          </Link>
        </p>
      </div>

      <Auth
        supabaseClient={supabase}
        view="sign_up"
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
        redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=${encodeURIComponent('/dashboard')}`}
        onlyThirdPartyProviders={false}
        magicLink={false}
        showLinks={false}
      />

      <div className="mt-6 text-center text-sm text-muted-foreground">
        By creating an account, you agree to our{' '}
        <a href="#" className="text-primary hover:text-primary/80 transition-colors">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="text-primary hover:text-primary/80 transition-colors">
          Privacy Policy
        </a>
      </div>
    </div>
  );
}
