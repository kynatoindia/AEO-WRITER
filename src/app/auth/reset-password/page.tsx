'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery mode');
      }
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
          Update your password
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Enter your new password below.
        </p>
      </div>

      <Auth
        supabaseClient={supabase}
        view="update_password"
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
        onlyThirdPartyProviders={false}
        magicLink={false}
        showLinks={false}
      />
    </div>
  );
}
