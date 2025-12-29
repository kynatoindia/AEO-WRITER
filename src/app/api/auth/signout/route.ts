import { createRouteClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createRouteClient();

  // Check if we have a session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL('/auth/login', request.url), {
    status: 302,
  });
}