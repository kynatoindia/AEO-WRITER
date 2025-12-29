import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/lib/types';

// Client-side Supabase client for use in Client Components
export const createClientSupabaseClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

// Singleton client instance for client-side usage
export const supabase = createClientSupabaseClient();