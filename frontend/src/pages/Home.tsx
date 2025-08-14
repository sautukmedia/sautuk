import { useQuery } from '@tanstack/react-query';
import { Wifi, WifiOff, Loader2, BookOpen, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  // Check backend connection
  const { data, isLoading, isError } = useQuery({
    queryKey: ['backend-status'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000');
      if (!res.ok) throw new Error('Backend error');
      return res.text();
    },
    retry: 1,
  });

  return (
    <div className="min-h-screen bg-sautuk-bg font-sans flex flex-col selection:bg-sautuk-accent/30">
      {/* Top bar info */}
      <div className="bg-sautuk-dark text-sautuk-bg py-2 px-4 text-xs font-semibold uppercase tracking-wider flex justify-between items-center">
        <span>Sautuk Media Company - Production Grade Blogging</span>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="flex items-center gap-1 text-yellow-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Backend Connecting...
            </span>
          ) : isError ? (
            <span className="flex items-center gap-1 text-sautuk-cta">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400">
              <Wifi className="w-3.5 h-3.5" /> Backend Online: {data || 'OK'}
            </span>
          )}
        </div>
      </div>

      {/* Main Magazine Header */}
      <header className="border-b border-sautuk-dark/10 bg-white/70 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-sautuk-cta" />
            <span className="font-display text-2xl lg:text-3xl font-black tracking-tight text-sautuk-dark">
              SAUTUK<span className="text-sautuk-accent">.</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold uppercase tracking-wide text-sautuk-dark/80">
            <Link to="/" className="hover:text-sautuk-accent transition-colors">Home</Link>
            <span className="text-sautuk-muted/40">|</span>
            <Link to="/category/news" className="hover:text-sautuk-accent transition-colors">News</Link>
            <Link to="/category/business" className="hover:text-sautuk-accent transition-colors">Business</Link>
            <Link to="/category/tech" className="hover:text-sautuk-accent transition-colors">Tech</Link>
            <Link to="/category/opinion" className="hover:text-sautuk-accent transition-colors">Opinion</Link>
          </nav>
          <div>
            <Link
              to="/admin"
              className="bg-sautuk-cta text-white font-bold px-5 py-2.5 rounded-full hover:bg-sautuk-cta/90 transition-all shadow-md shadow-sautuk-cta/20 text-sm hover:scale-105 active:scale-95 block"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Content Section */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-grow w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Hero Story */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-sautuk-dark/5 hover-lift flex flex-col justify-between">
            <div>
              <span className="inline-block bg-sautuk-accent/20 text-sautuk-dark font-display font-extrabold uppercase text-xs tracking-widest px-3 py-1 rounded-full mb-4">
                Lead Story
              </span>
              <h1 className="text-3xl lg:text-5xl font-black text-sautuk-dark tracking-tight leading-tight mb-4 font-display">
                Next-Gen Blogging Platform Initialized for Sautuk Media
              </h1>
              <p className="text-sautuk-muted leading-relaxed mb-6 text-base lg:text-lg">
                Phase 1 project foundation has been successfully completed. Using React 19, Bun, NestJS, Prisma ORM, and Tailwind CSS v4, we are architecting a highly performant blogging platform. S3 and CloudFront integration will follow in upcoming development sprints.
              </p>
            </div>
            
            <div className="flex items-center justify-between border-t border-sautuk-dark/5 pt-6 mt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sautuk-accent/30 font-bold flex items-center justify-center text-sautuk-dark">
                  AP
                </div>
                <div>
                  <h4 className="font-bold text-sm text-sautuk-dark">Aditya Pandey</h4>
                  <p className="text-xs text-sautuk-muted">Senior Software Engineer</p>
                </div>
              </div>
              <button className="flex items-center gap-1.5 text-sautuk-cta font-extrabold text-sm hover:underline">
                Read Full Spec <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sidebar Highlights */}
          <div className="flex flex-col gap-6">
            <div className="bg-sautuk-dark text-white rounded-3xl p-6 shadow-md relative overflow-hidden flex-grow flex flex-col justify-between">
              {/* Subtle background glow */}
              <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-sautuk-accent/20 blur-2xl"></div>
              
              <div>
                <h3 className="font-display font-black text-xl lg:text-2xl text-sautuk-accent mb-2">
                  Production-Ready Tech Stack
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  Fully typed frontend in TypeScript, combined with NestJS dependency injection architecture and Prisma client mappings.
                </p>
              </div>
              
              <ul className="text-xs font-semibold flex flex-wrap gap-2 z-10">
                <li className="bg-white/10 px-2.5 py-1.5 rounded-md text-white">NestJS v11</li>
                <li className="bg-white/10 px-2.5 py-1.5 rounded-md text-white">Prisma Client v7</li>
                <li className="bg-white/10 px-2.5 py-1.5 rounded-md text-white">React v19</li>
                <li className="bg-white/10 px-2.5 py-1.5 rounded-md text-white">Tailwind v4</li>
                <li className="bg-white/10 px-2.5 py-1.5 rounded-md text-white">Bun Manager</li>
              </ul>
            </div>

            {/* Trending Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-sautuk-dark/5 hover-lift">
              <div className="flex items-center gap-2 text-sautuk-cta mb-3 font-bold text-xs uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" /> Trending Articles
              </div>
              <h3 className="font-display font-black text-lg text-sautuk-dark mb-1 hover:text-sautuk-accent cursor-pointer transition-colors">
                Prisma v7 migration: What you need to know about adapters
              </h3>
              <p className="text-xs text-sautuk-muted">5 min read • Development Insights</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-sautuk-dark text-sautuk-muted py-8 px-4 text-center text-sm border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-semibold text-slate-400">© 2026 Sautuk Media. All rights reserved.</p>
          <div className="flex gap-4 font-bold text-xs uppercase tracking-wider text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
