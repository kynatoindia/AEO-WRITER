import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AEO Writer Pro",
  description: "AI-powered SEO content generation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen relative overflow-x-hidden`}
      >
        {/* Enhanced Modern Dark Blue/Purple Background Animation */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          {/* Primary Dark Blue Orbs */}
          <div className="absolute top-[-15%] left-[-15%] w-[60%] h-[60%] bg-gradient-to-br from-blue-600/20 via-indigo-700/15 to-transparent blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-15%] right-[-15%] w-[60%] h-[60%] bg-gradient-to-tl from-purple-600/20 via-violet-700/15 to-transparent blur-[120px] rounded-full animate-pulse delay-700" />
          
          {/* Secondary Purple Orbs */}
          <div className="absolute top-[20%] right-[10%] w-[45%] h-[45%] bg-gradient-to-bl from-indigo-500/12 via-purple-600/8 to-transparent blur-[120px] rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-[30%] left-[5%] w-[40%] h-[40%] bg-gradient-to-tr from-blue-500/12 via-indigo-600/8 to-transparent blur-[120px] rounded-full animate-pulse delay-1500" />
          
          {/* Accent Electric Purple Orbs */}
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-gradient-radial from-primary/8 to-transparent blur-[80px] rounded-full animate-pulse-slow" />
          <div className="absolute top-[10%] left-[60%] w-[25%] h-[25%] bg-gradient-to-br from-violet-500/10 via-purple-600/6 to-transparent blur-[100px] rounded-full animate-pulse delay-2000" />
          
          {/* Floating Particles with Blue/Purple Theme */}
          <div className="absolute top-[10%] left-[20%] w-2 h-2 bg-primary/40 rounded-full animate-float" style={{ animationDelay: '0s' }} />
          <div className="absolute top-[60%] right-[25%] w-1 h-1 bg-indigo-400/50 rounded-full animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-[20%] left-[70%] w-1.5 h-1.5 bg-violet-400/40 rounded-full animate-float" style={{ animationDelay: '4s' }} />
          <div className="absolute top-[30%] left-[10%] w-1 h-1 bg-blue-400/45 rounded-full animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-[40%] right-[15%] w-1.5 h-1.5 bg-purple-400/35 rounded-full animate-float" style={{ animationDelay: '3s' }} />
        </div>

        <AuthProvider>
          <main className="relative z-0">
            {children}
          </main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
