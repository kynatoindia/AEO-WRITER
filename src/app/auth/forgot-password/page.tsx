'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [emailSent, setEmailSent] = useState(false);

  return (
    <div className="glass-card py-8 px-6 rounded-2xl border border-white/10 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground text-center">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Enter your email address and we&apos;ll send you a reset link.
        </p>
      </div>

      {emailSent ? (
        <div className="text-center">
          <div className="mb-4 p-4 rounded-xl border status-success-modern">
            <p className="text-sm font-medium">
              Check your email for a password reset link.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <Auth
            supabaseClient={supabase}
            view="forgotten_password"
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
            redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`}
            onlyThirdPartyProviders={false}
            magicLink={false}
            showLinks={false}
          />

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
