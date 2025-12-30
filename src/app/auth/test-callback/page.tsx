'use client';

import { useEffect, useState } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

export default function TestCallbackPage() {
  const [status, setStatus] = useState('Loading...');
  const [details, setDetails] = useState<any>(null);
  const searchParams = useSearchParams();
  const supabase = createClientSupabaseClient();

  useEffect(() => {
    const testAuth = async () => {
      try {
        // Get current session
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          setStatus('Session Error');
          setDetails({ error: sessionError.message });
          return;
        }

        if (session?.session?.user) {
          setStatus('Authenticated');
          setDetails({
            user: session.session.user.email,
            confirmed: session.session.user.email_confirmed_at,
            role: session.session.user.role
          });
        } else {
          setStatus('Not Authenticated');
          setDetails({ 
            searchParams: Object.fromEntries(searchParams.entries()),
            url: window.location.href
          });
        }
      } catch (error) {
        setStatus('Error');
        setDetails({ error: error.message });
      }
    };

    testAuth();
  }, [supabase, searchParams]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Auth Test Page</h1>
      <div className="bg-gray-100 p-4 rounded">
        <p><strong>Status:</strong> {status}</p>
        <pre className="mt-4 text-sm overflow-auto">
          {JSON.stringify(details, null, 2)}
        </pre>
      </div>
      
      <div className="mt-6 space-y-2">
        <a href="/auth/login" className="block text-blue-600 hover:underline">
          Go to Login
        </a>
        <a href="/dashboard" className="block text-blue-600 hover:underline">
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}