import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, isUserSuspended, checkGlobalRateLimit } from '@/lib/rate-limiting/quota';

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable — treat as unauthenticated, let requests through to API routes
    // which will handle auth themselves
    return supabaseResponse;
  }

  // Protected routes that require authentication
  const protectedPaths = ['/dashboard', '/project', '/api/projects', '/api/research', '/api/blueprint', '/api/write'];
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  // API routes that need rate limiting
  const rateLimitedPaths = ['/api/projects', '/api/ai', '/api/content', '/api/user'];
  const isRateLimitedPath = rateLimitedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  // Apply rate limiting to API routes for authenticated users (skip in development)
  if (isRateLimitedPath && user && process.env.NODE_ENV !== 'development') {
    try {
      // Check if user is suspended due to abuse
      const suspended = await isUserSuspended(user.id);
      if (suspended) {
        return NextResponse.json(
          {
            error: 'Account temporarily suspended due to excessive requests',
            retryAfter: 3600, // 1 hour
          },
          {
            status: 429,
            headers: {
              'Retry-After': '3600',
            },
          }
        );
      }

      // Check global rate limit for high-traffic endpoints
      const endpoint = request.nextUrl.pathname;
      if (endpoint.includes('/api/ai/') || endpoint.includes('/api/content/')) {
        const globalResult = await checkGlobalRateLimit(endpoint, 300, 1000); // 5 min window, 1000 requests

        if (!globalResult.allowed) {
          return NextResponse.json(
            {
              error: 'Service temporarily unavailable due to high demand',
              retryAfter: globalResult.resetTime,
            },
            {
              status: 503,
              headers: {
                'Retry-After': globalResult.resetTime.toString(),
              },
            }
          );
        }
      }

      // Apply user-specific rate limiting
      const rateLimitResult = await checkRateLimit(
        user.id,
        60, // 1 minute window
        endpoint.includes('/api/ai/') ? 5 : 20, // Stricter limits for AI endpoints
        endpoint
      );

      if (!rateLimitResult.allowed) {
        const headers: Record<string, string> = {
          'X-RateLimit-Limit': (endpoint.includes('/api/ai/') ? 5 : 20).toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          'Retry-After': (rateLimitResult.retryAfter || rateLimitResult.resetTime).toString(),
        };

        // Add abuse warning header
        if (rateLimitResult.isAbusive) {
          headers['X-Abuse-Warning'] = 'Excessive requests detected';
        }

        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter || rateLimitResult.resetTime,
            isAbusive: rateLimitResult.isAbusive,
          },
          {
            status: 429,
            headers,
          }
        );
      }

      // Add rate limit headers to successful responses
      supabaseResponse.headers.set('X-RateLimit-Limit', (endpoint.includes('/api/ai/') ? 5 : 20).toString());
      supabaseResponse.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      supabaseResponse.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

    } catch (error) {
      console.error('Rate limiting error in middleware:', error);
      // Continue without rate limiting on error to avoid blocking legitimate requests
    }
  }

  // Redirect unauthenticated users to login page
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  const authPaths = ['/auth/login', '/auth/register', '/auth/forgot-password'];
  const isAuthPath = authPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
