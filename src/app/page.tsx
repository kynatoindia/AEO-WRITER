'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Search, PenTool, Zap, ArrowRight,
  Globe, Layers, CheckCircle, Terminal,
  Github, Star, Shield
} from 'lucide-react';
import { Footer } from '@/components/ui/footer';
import { Navigation } from '@/components/ui/navigation';

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Navigation />

      {/* Subtle background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/5 blur-[140px] rounded-full" />
        <div className="absolute bottom-1/3 right-[-10%] w-[500px] h-[500px] bg-primary/3 blur-[120px] rounded-full" />
      </div>

      {/* ── Hero ── */}
      <section className="pt-32 pb-12 px-4">
        <div className="container mx-auto max-w-5xl text-center">

          {/* Open source badge */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-primary/25 bg-primary/8 text-sm text-primary font-medium mb-8"
          >
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
            Open Source — MIT License
            <span className="w-px h-3 bg-primary/30" />
            <Github className="w-3.5 h-3.5 opacity-70" />
            <span className="text-primary/70">Free to use</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
          >
            <span className="text-white">Write Content for the</span>
            <br />
            <span className="text-primary">Answer Engine</span>
            <span className="text-white"> Era</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-white/55 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            An open-source AI agent that researches, blueprints, and writes long-form content
            optimized for AI-powered search engines — transparent, customizable, and self-hostable.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-4 justify-center"
          >
            <Button asChild size="lg" className="px-8 h-12 text-base rounded-xl">
              <Link href="/auth/register">
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-8 h-12 text-base rounded-xl">
              <Link href="/auth/login">
                <Github className="mr-2 w-4 h-4" />
                View on GitHub
              </Link>
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-5 text-sm text-white/25"
          >
            MIT License · Self-hostable · Bring your own API keys
          </motion.p>
        </div>
      </section>

      {/* ── Pipeline Mockup ── */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-white/10 overflow-hidden shadow-2xl shadow-black/40"
            style={{ background: 'hsl(220 27% 6%)' }}
          >
            {/* Terminal bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8" style={{ background: 'hsl(220 27% 8%)' }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="ml-2 text-xs text-white/25 font-mono">aeo-writer — pipeline</span>
            </div>
            {/* Steps */}
            <div className="p-5 font-mono text-sm space-y-3">
              <PipelineStep status="done" label="Research Phase" detail="12 sources · Tavily web search complete" time="3.2s" />
              <PipelineStep status="done" label="Blueprint Generated" detail="8 sections with goals and key points" time="1.8s" />
              <PipelineStep status="active" label="Writing Section 3/8" detail="&quot;Key Benefits of AEO&quot; — streaming..." time="" />
              <div className="mt-3">
                <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full w-[37%] bg-primary rounded-full transition-all duration-1000" />
                </div>
                <p className="text-white/25 text-xs mt-1.5">37% complete · est. 2 min remaining</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              A complete content pipeline
            </h2>
            <p className="text-white/45 max-w-xl mx-auto leading-relaxed">
              Not a wrapper around a chat API. A multi-step agent that plans before writing —
              open source and transparent at every step.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Globe className="w-5 h-5 text-primary" />}
              title="Deep Web Research"
              description="Tavily-powered agents crawl authoritative sources and competitor content to ground every article in real data."
              delay={0}
            />
            <FeatureCard
              icon={<Layers className="w-5 h-5 text-primary" />}
              title="AI Content Blueprint"
              description="Before writing a word, the AI generates a full structural plan: sections, goals, key points, and sub-topics."
              delay={0.05}
            />
            <FeatureCard
              icon={<PenTool className="w-5 h-5 text-primary" />}
              title="Section-by-Section Writing"
              description="Content streams live, section by section. Review, edit, or regenerate any part before finalizing."
              delay={0.1}
            />
            <FeatureCard
              icon={<Zap className="w-5 h-5 text-primary" />}
              title="AEO Optimization"
              description="Structured for featured snippets, People Also Ask, and AI answer engines like Perplexity, SGE, and SearchGPT."
              delay={0.15}
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5 text-primary" />}
              title="Fact Verification"
              description="Sources are cited and tracked through the pipeline. No hallucinated statistics or unsourced claims."
              delay={0.2}
            />
            <FeatureCard
              icon={<Terminal className="w-5 h-5 text-primary" />}
              title="Full Pipeline Visibility"
              description="Watch every agent step live: research queries, blueprint decisions, and streaming output — no black boxes."
              delay={0.25}
            />
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section className="py-20 px-4" style={{ borderTop: '1px solid hsl(220 27% 12%)', borderBottom: '1px solid hsl(220 27% 12%)', background: 'hsl(220 27% 7%)' }}>
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">How it works</h2>
            <p className="text-white/40">Three phases. One pipeline.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-9 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px"
              style={{ background: 'linear-gradient(90deg, transparent, hsl(152 65% 48% / 0.4), transparent)' }}
            />
            <HowItWorksStep
              number="01"
              icon={<Search className="w-5 h-5 text-primary" />}
              title="Research"
              description="Enter your topic. Agents search the web, analyze competitors, and gather data from authoritative sources."
              delay={0}
            />
            <HowItWorksStep
              number="02"
              icon={<Layers className="w-5 h-5 text-primary" />}
              title="Blueprint"
              description="Review the AI-generated content plan. Reorder sections, adjust goals, and add your own talking points."
              delay={0.1}
            />
            <HowItWorksStep
              number="03"
              icon={<PenTool className="w-5 h-5 text-primary" />}
              title="Generate"
              description="Content streams in real-time — section by section, with full control to edit or regenerate anything."
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* ── Open Source Callout ── */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-primary/20 p-10 text-center"
            style={{ background: 'hsl(152 65% 48% / 0.04)' }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-5">
              <Github className="w-3.5 h-3.5" />
              Open Source
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Built in the open</h2>
            <p className="text-white/55 mb-8 leading-relaxed max-w-xl mx-auto">
              MIT licensed and fully self-hostable. Use your own API keys, run it on your
              infrastructure, fork it, and extend it. No vendor lock-in, no black boxes.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-8">
              {['MIT License', 'Self-hostable', 'Own API keys', 'No vendor lock-in'].map((label) => (
                <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white/60"
                  style={{ background: 'hsl(220 27% 10%)' }}>
                  <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  {label}
                </div>
              ))}
            </div>
            <Button asChild variant="outline" size="lg" className="px-8 h-12 rounded-xl border-primary/30 hover:bg-primary/10 hover:border-primary/50">
              <Link href="/auth/register">
                <Github className="mr-2 w-4 h-4" />
                Star on GitHub
                <Star className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">Start creating smarter content</h2>
            <p className="text-white/45 mb-8">Free to use. No credit card required. Open source.</p>
            <Button asChild size="lg" className="px-10 h-12 text-base rounded-xl">
              <Link href="/auth/register">
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ── Helper components ── */

function PipelineStep({
  status,
  label,
  detail,
  time,
}: {
  status: 'done' | 'active' | 'pending';
  label: string;
  detail: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex-shrink-0 ${
        status === 'done' ? 'text-primary' :
        status === 'active' ? 'text-white/70 animate-pulse' :
        'text-white/20'
      }`}>
        {status === 'done' ? '✓' : status === 'active' ? '⟳' : '○'}
      </span>
      <div className="flex-1 min-w-0">
        <span className={`font-medium ${status === 'done' ? 'text-white/80' : status === 'active' ? 'text-white' : 'text-white/30'}`}>
          {label}
        </span>
        <span className="ml-2 text-white/35 text-xs truncate" dangerouslySetInnerHTML={{ __html: detail }} />
      </div>
      {time && <span className="text-white/25 text-xs flex-shrink-0">{time}</span>}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="p-6 rounded-xl border border-white/8 hover:border-primary/30 transition-colors duration-300 group"
      style={{ background: 'hsl(220 27% 9%)' }}
    >
      <div className="mb-4 p-2.5 rounded-lg border border-white/8 w-fit"
        style={{ background: 'hsl(152 65% 48% / 0.08)' }}>
        {icon}
      </div>
      <h3 className="text-white font-semibold mb-2 text-[15px]">{title}</h3>
      <p className="text-white/45 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

function HowItWorksStep({
  number,
  icon,
  title,
  description,
  delay,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="flex flex-col items-center text-center"
    >
      <div className="w-16 h-16 rounded-2xl border border-primary/20 flex items-center justify-center mb-5 relative"
        style={{ background: 'hsl(152 65% 48% / 0.06)' }}>
        {icon}
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full border border-primary/30 bg-background flex items-center justify-center text-[9px] text-primary font-bold">
          {number.replace('0', '')}
        </span>
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-white/45 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
