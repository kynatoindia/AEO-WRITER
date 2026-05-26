import { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Authentication - AEO Writer Pro',
  description: 'Sign in to your AEO Writer Pro account',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] bg-gradient-to-br from-primary/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-gradient-to-tl from-primary/8 to-transparent blur-[120px] rounded-full" />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3 group justify-center mb-2">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <span className="text-2xl font-bold text-gradient-primary">AEO Writer Pro</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-powered SEO content generation
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
