'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const message = searchParams.get('message');

  const getErrorDetails = () => {
    switch (error) {
      case 'no_code':
        return {
          title: 'Invalid Authentication Link',
          description: 'The authentication link appears to be malformed or incomplete.',
          suggestion: 'Please try signing up or logging in again.'
        };
      case 'exchange_failed':
        return {
          title: 'Authentication Failed',
          description: message || 'Failed to complete the authentication process.',
          suggestion: 'The link may have expired. Please try signing up or logging in again.'
        };
      case 'callback_error':
        return {
          title: 'Authentication Error',
          description: 'An unexpected error occurred during authentication.',
          suggestion: 'Please try again or contact support if the problem persists.'
        };
      default:
        return {
          title: 'Authentication Error',
          description: message || "Sorry, we couldn't authenticate your account. This could be due to an expired or invalid link.",
          suggestion: 'Please try signing in again.'
        };
    }
  };

  const errorDetails = getErrorDetails();

  return (
    <div className="glass-card py-8 px-6 rounded-2xl border border-white/10 shadow-2xl">
      <div className="text-center">
        <div className="mb-4">
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-4">
          {errorDetails.title}
        </h2>

        <p className="text-muted-foreground mb-2">
          {errorDetails.description}
        </p>

        <p className="text-sm text-muted-foreground/70 mb-6">
          {errorDetails.suggestion}
        </p>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground text-left">
            <strong className="text-foreground/70">Error Code:</strong> {error}
            {message && (
              <>
                <br />
                <strong className="text-foreground/70">Details:</strong> {message}
              </>
            )}
          </div>
        )}

        <div className="space-y-3">
          <Button asChild className="w-full rounded-xl">
            <Link href="/auth/login">Try signing in again</Link>
          </Button>

          <Button asChild variant="outline" className="w-full rounded-xl glass-card border-white/10 hover:bg-white/8">
            <Link href="/auth/register">Create a new account</Link>
          </Button>

          <Link
            href="/auth/forgot-password"
            className="block w-full text-sm text-primary hover:text-primary/80 transition-colors py-1"
          >
            Request a new password reset link
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={
      <div className="glass-card py-8 px-6 rounded-2xl border border-white/10">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
