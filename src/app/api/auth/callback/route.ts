import { createRouteClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  console.log('Auth callback received:', { 
    code: !!code, 
    next, 
    origin, 
    error,
    error_description,
    fullUrl: request.url 
  });

  // Handle error from Supabase
  if (error) {
    console.error('Supabase auth error:', { error, error_description });
    const errorUrl = new URL('/auth/auth-code-error', origin);
    errorUrl.searchParams.set('error', error);
    errorUrl.searchParams.set('message', error_description || 'Authentication failed');
    return NextResponse.redirect(errorUrl.toString());
  }

  if (code) {
    try {
      const supabase = await createRouteClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      console.log('Code exchange result:', { 
        success: !error, 
        error: error?.message,
        user: data?.user?.email,
        session: !!data?.session
      });
      
      if (!error && data?.user) {
        // Successful authentication
        const forwardedHost = request.headers.get('x-forwarded-host');
        const isLocalEnv = process.env.NODE_ENV === 'development';
        
        const redirectUrl = isLocalEnv 
          ? `${origin}${next}`
          : forwardedHost 
            ? `https://${forwardedHost}${next}`
            : `${origin}${next}`;
            
        console.log('Successful auth, redirecting to:', redirectUrl);
        return NextResponse.redirect(redirectUrl);
      } else {
        console.error('Auth exchange failed:', error);
        const errorUrl = new URL('/auth/auth-code-error', origin);
        errorUrl.searchParams.set('error', 'exchange_failed');
        errorUrl.searchParams.set('message', error?.message || 'Failed to exchange code for session');
        return NextResponse.redirect(errorUrl.toString());
      }
    } catch (err) {
      console.error('Auth callback error:', err);
      const errorUrl = new URL('/auth/auth-code-error', origin);
      errorUrl.searchParams.set('error', 'callback_error');
      errorUrl.searchParams.set('message', 'An unexpected error occurred during authentication');
      return NextResponse.redirect(errorUrl.toString());
    }
  } else {
    console.log('No code parameter found in callback');
    const errorUrl = new URL('/auth/auth-code-error', origin);
    errorUrl.searchParams.set('error', 'no_code');
    errorUrl.searchParams.set('message', 'No authentication code provided');
    return NextResponse.redirect(errorUrl.toString());
  }
}