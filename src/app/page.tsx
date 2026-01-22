'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion, useScroll, useTransform } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Search, PenTool, Zap, ArrowRight, Shield, Globe, Sparkles } from 'lucide-react';
import { Footer } from '@/components/ui/footer';
import { Navigation } from '@/components/ui/navigation';

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const { scrollY } = useScroll();

  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/dashboard');
      } else {
        setIsLoading(false);
      }
    };
    checkUser();
  }, [supabase, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[20%] left-[10%] w-96 h-96 bg-gradient-to-br from-primary/10 to-purple-600/5 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-gradient-to-tl from-indigo-600/8 to-cyan-500/5 blur-[100px] rounded-full animate-pulse delay-1000" />
        </div>
        
        <div className="glass-card p-12 rounded-3xl border border-white/10 text-center">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gradient mb-2">Initializing AEO Writer Pro</h3>
          <p className="text-muted-foreground">Preparing your AI content workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <motion.div
          style={{ y: y1, opacity }}
          className="container mx-auto text-center relative z-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass-card mb-8 text-sm font-medium text-primary border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>The Future of SEO Content is Here</span>
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-6xl md:text-8xl lg:text-9xl font-bold mb-8 tracking-tight leading-none"
          >
            <span className="text-gradient block">Craft Content That</span>
            <span className="text-gradient-rainbow block mt-2">Dominates Search</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            AEO Writer Pro leverages advanced agentic AI to research, write, and optimize
            your content for the next generation of search engines.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          >
            <Button asChild size="lg" className="auth-button px-12 h-16 text-lg rounded-2xl hover-lift group">
              <Link href="/auth/register">
                Start Building Now 
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button variant="outline" asChild size="lg" className="glass-card h-16 px-12 text-lg border-white/10 hover:bg-white/8 rounded-2xl hover-lift">
              <Link href="/auth/login">
                View Live Demo
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Enhanced Decorative Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 overflow-hidden">
          <div className="absolute top-[10%] left-[5%] w-72 h-72 bg-gradient-to-br from-primary/15 to-purple-600/10 blur-[100px] rounded-full animate-float" />
          <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-gradient-to-tl from-purple-600/15 to-pink-500/10 blur-[100px] rounded-full animate-float" style={{ animationDelay: '-3s' }} />
          <div className="absolute top-[30%] right-[20%] w-64 h-64 bg-gradient-to-bl from-cyan-500/10 to-blue-500/8 blur-[80px] rounded-full animate-float" style={{ animationDelay: '-1.5s' }} />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 relative">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Search className="w-8 h-8 text-primary" />}
              title="Deep Research"
              description="Our agents crawl the web to find the most relevant data and competitor insights for your niche."
              delay={0.2}
            />
            <FeatureCard
              icon={<PenTool className="w-8 h-8 text-primary" />}
              title="Agentic Writing"
              description="Not just a LLM wrapper. Our agents follow a multi-step process to ensure quality and accuracy."
              delay={0.4}
            />
            <FeatureCard
              icon={<Zap className="w-8 h-8 text-primary" />}
              title="Instant SEO"
              description="Automatically optimized for keywords, featured snippets, and search intent from the start."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* Enhanced Trust Section */}
      <section className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-white/5 backdrop-blur-sm border-y border-white/5" />
        <div className="container mx-auto text-center relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold mb-16 text-gradient-rainbow"
          >
            Powered by Industry Leaders
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-12 opacity-60 hover:opacity-100 transition-opacity duration-500"
          >
            {/* Enhanced Placeholder Logos */}
            <div className="flex items-center gap-3 text-2xl font-bold hover:text-primary transition-colors duration-300 cursor-pointer">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <Globe className="w-8 h-8" />
              </div>
              GlobalScale
            </div>
            <div className="flex items-center gap-3 text-2xl font-bold hover:text-primary transition-colors duration-300 cursor-pointer">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <Shield className="w-8 h-8" />
              </div>
              SecureNet
            </div>
            <div className="flex items-center gap-3 text-2xl font-bold hover:text-primary transition-colors duration-300 cursor-pointer">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <Zap className="w-8 h-8" />
              </div>
              RapidFlow
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay }}
      className="p-8 glass-dark rounded-3xl border border-white/5 hover:border-primary/30 transition-all duration-500 group hover-lift relative overflow-hidden"
    >
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-purple-600/20 to-pink-500/20 rounded-3xl blur opacity-0 group-hover:opacity-75 transition-opacity duration-500" />
      
      <div className="relative z-10">
        <div className="mb-6 p-4 bg-gradient-to-br from-primary/15 to-purple-600/10 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-500 border border-white/10">
          {icon}
        </div>
        <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-gradient-primary transition-all duration-300">{title}</h3>
        <p className="text-muted-foreground leading-relaxed group-hover:text-white/80 transition-colors duration-300">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
