import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/lib/database.types';

// Client-side Supabase client for use in Client Components
export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

// Export a singleton instance for convenience
export const supabase = createClient();