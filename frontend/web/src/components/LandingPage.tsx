import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Shield, Zap, Brain, Smartphone, Lock, TrendingUp, CloudRain, Thermometer,
  Wind, AlertTriangle, CheckCircle2, ArrowRight, ChevronRight, Bike, Users,
  BarChart3, Globe, ClipboardX, Clock, FileWarning, Banknote, WifiOff,
  ShieldCheck, Star, Play, Menu, X,
} from 'lucide-react';
import { AasaraLogo } from './AasaraLogo';

interface LandingPageProps {
  onGetStarted: () => void;
}

// ─── Fade-in wrapper ──────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 28 }} animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ children, className = '', id = '' }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`py-20 px-4 sm:px-6 lg:px-8 ${className}`}>{children}</section>;
}

function MaxWidth({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`max-w-6xl mx-auto ${className}`}>{children}</div>;
}

function SectionTag({ text }: { text: string }) {
  return (
    <span className="inline-block text-xs font-bold uppercase tracking-[0.18em] text-teal-600 bg-teal-50 border border-teal-100 rounded-full px-3 py-0.5 mb-3">
      {text}
    </span>
  );
}

function SectionHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-3xl sm:text-4xl font-black text-[#1A3668] leading-tight ${className}`}>{children}</h2>;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [countUp, setCountUp] = useState({ workers: 0, payout: 0, speed: 0 });

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Count-up animation for stats
  useEffect(() => {
    const targets = { workers: 2400, payout: 700, speed: 30 };
    const steps = 60;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const pct = step / steps;
      const ease = 1 - Math.pow(1 - pct, 3);
      setCountUp({
        workers: Math.round(targets.workers * ease),
        payout: Math.round(targets.payout * ease),
        speed: Math.round(targets.speed * ease),
      });
      if (step >= steps) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="font-sans antialiased bg-white overflow-x-hidden">

      {/* ════════════════════════════════════════════════════════
          NAVBAR
      ════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        navScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100' : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <AasaraLogo size="lg" className="w-14 h-14" />
            <span className={`text-2xl font-black tracking-tight ${navScrolled ? 'text-[#1A3668]' : 'text-white'}`}>Aasara AI</span>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: 'How It Works', id: 'how-it-works' },
              { label: 'Features', id: 'features' },
              { label: 'Impact', id: 'impact' },
              { label: 'Trust', id: 'trust' },
            ].map(({ label, id }) => (
              <button key={id} onClick={() => scrollTo(id)}
                className={`text-base font-semibold transition-colors ${navScrolled ? 'text-slate-600 hover:text-[#1A3668]' : 'text-white/80 hover:text-white'}`}>
                {label}
              </button>
            ))}
            <button onClick={onGetStarted}
              className="ml-2 px-5 py-2.5 bg-gradient-to-r from-[#38C7D2] to-[#1E9CA4] hover:from-[#1E9CA4] hover:to-[#0d9488] text-white text-base font-bold rounded-lg shadow-md transition-all">
              Get Covered →
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen
              ? <X className={`w-6 h-6 ${navScrolled ? 'text-slate-700' : 'text-white'}`} />
              : <Menu className={`w-6 h-6 ${navScrolled ? 'text-slate-700' : 'text-white'}`} />
            }
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-white border-b border-slate-100 px-4 pb-4 space-y-2">
            {['How It Works', 'Features', 'Impact', 'Trust'].map((label) => (
              <button key={label} onClick={() => scrollTo(label.toLowerCase().replace(/ /g, '-'))}
                className="block w-full text-left text-sm font-semibold text-slate-700 hover:text-[#1A3668] py-2">
                {label}
              </button>
            ))}
            <button onClick={onGetStarted}
              className="w-full mt-2 px-4 py-2.5 bg-gradient-to-r from-[#38C7D2] to-[#1E9CA4] text-white text-sm font-bold rounded-lg">
              Get Covered Today
            </button>
          </motion.div>
        )}
      </nav>

      {/* ════════════════════════════════════════════════════════
          1. HERO
      ════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#1A3668] via-[#254B85] to-[#1E9CA4]">
        {/* Decorative mesh */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />

        <MaxWidth className="relative text-center px-4 pt-24 pb-20">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-teal-300 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <Zap className="w-3.5 h-3.5" /> Zero-Touch Parametric Insurance
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight max-w-4xl mx-auto">
            Instantly Secure Your Income.{' '}
            <span className="bg-gradient-to-r from-[#38C7D2] to-teal-300 bg-clip-text text-transparent">
              Your Safety Net,<br className="hidden sm:block" /> No Strings Attached.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-blue-100/90 max-w-2xl mx-auto leading-relaxed font-medium">
            Aasara AI provides zero-touch, parametric coverage against severe weather and disruptions —
            putting money back in your pocket instantly. <span className="text-white font-bold">No paperwork. No claims process.</span>
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button onClick={onGetStarted}
              className="px-8 py-4 bg-gradient-to-r from-[#38C7D2] to-[#1E9CA4] hover:from-[#1E9CA4] hover:to-[#0d9488] text-white text-base font-black rounded-xl shadow-lg shadow-teal-900/30 transition-all flex items-center gap-2 group">
              Get Covered Today
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="https://www.youtube.com/watch?v=31V0FUuuhiw" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold transition-colors group">
              <span className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center group-hover:border-white transition-colors">
                <Play className="w-3.5 h-3.5 ml-0.5" />
              </span>
              Watch 2-min Demo
            </a>
          </motion.div>

          {/* Hero stats bar */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.45 }}
            className="mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto">
            {[
              { value: `₹${countUp.payout}`, label: 'Per-event payout' },
              { value: `<${countUp.speed}s`, label: 'Payout speed' },
              { value: `₹4–7`, label: 'Daily premium' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-white">{s.value}</p>
                <p className="text-xs text-blue-200 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Scroll cue */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="mt-16 flex justify-center">
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}
              className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center pt-2 cursor-pointer"
              onClick={() => scrollTo('problem')}>
              <div className="w-1 h-2 bg-white/60 rounded-full" />
            </motion.div>
          </motion.div>
        </MaxWidth>
      </section>

      {/* ════════════════════════════════════════════════════════
          2. THE PROBLEM
      ════════════════════════════════════════════════════════ */}
      <Section id="problem" className="bg-slate-50">
        <MaxWidth>
          <FadeIn className="text-center mb-14">
            <SectionTag text="The Problem" />
            <SectionHeading>Income Disruption Shouldn't Mean Financial Crisis.</SectionHeading>
            <p className="mt-4 text-slate-500 max-w-2xl mx-auto text-base leading-relaxed font-medium">
              India's 5 million gig delivery workers lose 20–30% of monthly earnings to external disruptions.
              They have <strong className="text-slate-700">zero safety net</strong>. Until now.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: CloudRain,
                color: 'from-blue-500 to-cyan-500',
                bgLight: 'bg-blue-50',
                borderColor: 'border-blue-100',
                title: 'Climate Anomalies',
                description: 'Heatwaves (>42°C), monsoon rain (>20mm/hr), severe AQI pollution. Workers can\'t ride but still have to pay bills.',
                tags: ['Heatwave', 'Heavy Rain', 'Air Pollution'],
              },
              {
                icon: AlertTriangle,
                color: 'from-amber-500 to-orange-500',
                bgLight: 'bg-amber-50',
                borderColor: 'border-amber-100',
                title: 'Social Disruptions',
                description: 'Sudden curfews, transport strikes, and political bandhs shut down operations with zero notice or compensation.',
                tags: ['Curfews', 'Strikes', 'Bandhs'],
              },
              {
                icon: ClipboardX,
                color: 'from-red-500 to-rose-500',
                bgLight: 'bg-red-50',
                borderColor: 'border-red-100',
                title: 'Traditional Insurance Fails',
                description: '"Complex paperwork. Claims adjusters. 2–4 weeks wait." For gig workers operating day-to-day, latency is poverty.',
                tags: ['Weeks of Waiting', 'Paperwork', 'Rejections'],
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className={`bg-white rounded-2xl border ${item.borderColor} p-6 h-full hover:shadow-md transition-shadow`}>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-sm`}>
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">{item.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map(tag => (
                      <span key={tag} className={`text-[10px] font-bold uppercase tracking-wide ${item.bgLight} px-2 py-0.5 rounded-full text-slate-600 border ${item.borderColor}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </MaxWidth>
      </Section>

      {/* ════════════════════════════════════════════════════════
          3. THE SOLUTION
      ════════════════════════════════════════════════════════ */}
      <Section id="solution" className="bg-white">
        <MaxWidth>
          <FadeIn className="text-center mb-14">
            <SectionTag text="The Solution" />
            <SectionHeading>Aasara AI: The Instant Payout Solution.</SectionHeading>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto text-base font-medium">
              We replaced the entire claims process with parametric automation.
            </p>
          </FadeIn>

          <FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-4xl mx-auto">
              {/* Traditional — muted */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-7">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                    <ClipboardX className="w-4 h-4 text-slate-500" />
                  </div>
                  <h3 className="text-base font-bold text-slate-500 uppercase tracking-wide">Traditional Insurance</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: FileWarning, text: 'Complex Forms & Paperwork' },
                    { icon: Users, text: 'Claims Adjuster Required' },
                    { icon: Clock, text: '2–4 Weeks to Process' },
                    { icon: TrendingUp, text: 'Indemnity-Based Model' },
                    { icon: WifiOff, text: 'Manual & Opaque' },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <X className="w-3 h-3 text-red-400" />
                      </span>
                      <span className="text-sm font-medium text-slate-500">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aasara — highlighted with gradient ring */}
              <div className="relative bg-gradient-to-br from-[#1A3668] to-[#254B85] rounded-2xl p-7 shadow-xl shadow-navy-900/20">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#38C7D2]/10 to-transparent pointer-events-none" />
                <div className="flex items-center gap-3 mb-6 relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#38C7D2] to-[#1E9CA4] flex items-center justify-center shadow">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wide">Aasara AI</h3>
                  <span className="ml-auto text-[10px] font-black text-[#38C7D2] bg-[#38C7D2]/10 border border-[#38C7D2]/30 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Parametric
                  </span>
                </div>
                <div className="relative space-y-3">
                  {[
                    { text: 'Zero-Touch Validation', sub: 'Sensor fusion + ML verify automatically' },
                    { text: 'Automated Triggers', sub: 'WAQI + OpenWeatherMap API' },
                    { text: 'Instant UPI Payout', sub: 'Money in wallet in seconds' },
                    { text: 'AI Fraud Defense', sub: 'IsolationForest + kinematic analysis' },
                    { text: 'Transparent & On-Chain', sub: 'Chainlink audit trail' },
                  ].map(({ text, sub }, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#38C7D2]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-[#38C7D2]" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-white">{text}</p>
                        <p className="text-[11px] text-blue-200/70 font-medium">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </MaxWidth>
      </Section>

      {/* ════════════════════════════════════════════════════════
          4. KEY FEATURES
      ════════════════════════════════════════════════════════ */}
      <Section id="features" className="bg-slate-50">
        <MaxWidth>
          <FadeIn className="text-center mb-14">
            <SectionTag text="Features" />
            <SectionHeading>Built for the Modern Gig Economy.</SectionHeading>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Bike,
                gradient: 'from-teal-500 to-cyan-400',
                title: 'Frictionless Onboarding',
                desc: 'Link your Zomato or Swiggy account and get fully covered in under 3 minutes. One-time UPI payment activates your policy.',
              },
              {
                icon: Brain,
                gradient: 'from-purple-500 to-violet-400',
                title: 'Dynamic ML Pricing',
                desc: 'Fair, predictive premiums (₹4–₹7/day) calculated by XGBoost trained on real-time weather, AQI, and disruption risk.',
              },
              {
                icon: Shield,
                gradient: 'from-rose-500 to-pink-400',
                title: '3-Layer Fraud Defense',
                desc: 'IsolationForest anomaly scoring, kinematic sensor fusion, and EfficientNet-B0 photo micro-verification protect the pool.',
              },
              {
                icon: Smartphone,
                gradient: 'from-amber-500 to-orange-400',
                title: 'Offline SMS Safety Net',
                desc: 'Twilio "Store & Forward" ensures payout confirmation texts reach you even when the network is down during a disaster.',
              },
              {
                icon: BarChart3,
                gradient: 'from-[#254B85] to-[#38C7D2]',
                title: 'Actuarial Solvency',
                desc: 'Community liquidity pool with BCR monitoring, circuit breakers, and automatic enrollment suspension to stay solvent.',
              },
              {
                icon: Globe,
                gradient: 'from-emerald-500 to-green-400',
                title: 'DPDP & SS Code Compliant',
                desc: '3-point DPDP Act 2023 consent gate. 90-day SS Code 2020 eligibility check. 48-hour lockout prevents adverse selection.',
              },
            ].map((f, i) => (
              <FadeIn key={i} delay={i * 0.05}>
                <div className="bg-white rounded-2xl border border-slate-100 p-6 h-full hover:shadow-md hover:border-teal-100 transition-all group">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-sm`}>
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-2 group-hover:text-[#1A3668] transition-colors">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </MaxWidth>
      </Section>

      {/* ════════════════════════════════════════════════════════
          5. HOW IT WORKS
      ════════════════════════════════════════════════════════ */}
      <Section id="how-it-works" className="bg-white">
        <MaxWidth>
          <FadeIn className="text-center mb-14">
            <SectionTag text="How It Works" />
            <SectionHeading>Simple. Automated. Done.</SectionHeading>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto text-base font-medium">
              From sign-up to payout — the entire process runs automatically.
            </p>
          </FadeIn>

          <div className="relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-transparent via-[#38C7D2]/40 to-transparent" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { step: '01', icon: Bike, color: 'from-[#254B85] to-[#38C7D2]', title: 'Link Platform', desc: 'Sign up. Connect your Zomato / Swiggy worker account.' },
                { step: '02', icon: Brain, color: 'from-purple-600 to-purple-400', title: 'ML Quote', desc: 'XGBoost calculates your personalised daily premium instantly.' },
                { step: '03', icon: CloudRain, color: 'from-blue-600 to-cyan-400', title: 'Disruption Trigger', desc: 'WAQI & OpenWeatherMap fire a Red Alert when thresholds are breached.' },
                { step: '04', icon: ShieldCheck, color: 'from-rose-600 to-pink-400', title: 'AI Validation', desc: 'IsolationForest scores location & sensors. Fraud auto-blocked.' },
                { step: '05', icon: Banknote, color: 'from-emerald-600 to-teal-400', title: 'Instant Payout', desc: 'UPI credit + SMS confirmation. ₹700 in your wallet in <30s.' },
              ].map((s, i) => (
                <FadeIn key={i} delay={i * 0.1} className="relative">
                  <div className="text-center flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-md mb-3 relative z-10`}>
                      <s.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{s.step}</span>
                    <h3 className="text-sm font-bold text-slate-800 mb-1.5">{s.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                    {/* Mobile step connector */}
                    {i < 4 && (
                      <div className="lg:hidden flex justify-center mt-4 mb-1">
                        <ChevronRight className="w-5 h-5 text-slate-200 rotate-90" />
                      </div>
                    )}
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </MaxWidth>
      </Section>

      {/* ════════════════════════════════════════════════════════
          6. IMPACT — RAVI'S TABLE
      ════════════════════════════════════════════════════════ */}
      <Section id="impact" className="bg-gradient-to-br from-[#1A3668] via-[#254B85] to-[#1E3A5F]">
        <MaxWidth>
          <FadeIn className="text-center mb-12">
            <SectionTag text="Real Impact" />
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              Aasara AI Makes a <span className="text-[#38C7D2]">Real Impact.</span>
            </h2>
            <p className="mt-4 text-blue-200 max-w-2xl mx-auto text-base font-medium">
              Ravi's Disaster Week: 2 days of severe monsoon flooding, Mumbai. This is what Aasara changes.
            </p>
          </FadeIn>

          <FadeIn>
            <div className="max-w-3xl mx-auto">
              {/* Table */}
              <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                <div className="grid grid-cols-3 bg-white/5 border-b border-white/10 px-6 py-3">
                  <p className="text-xs font-bold text-blue-200 uppercase tracking-wider">Financial Metric</p>
                  <p className="text-xs font-bold text-red-300 uppercase tracking-wider text-center">Without Aasara</p>
                  <p className="text-xs font-bold text-[#38C7D2] uppercase tracking-wider text-center">With Aasara</p>
                </div>

                {[
                  { metric: 'Gross Weekly Potential', before: '₹6,000', after: '₹6,000', highlight: false },
                  { metric: 'Operational Expenses', before: '−₹1,400', after: '−₹1,400', highlight: false },
                  { metric: 'Income Loss (2-Day Flood + Missed Bonus)', before: '−₹2,100', after: '−₹2,100', highlight: false },
                  { metric: 'Aasara Weekly Premium', before: '₹0', after: '−₹40', highlight: false },
                  { metric: 'Aasara Parametric Payout', before: '₹0', after: '+₹1,800', highlight: true },
                  { metric: 'Total Net Take-Home Pay', before: '₹2,500', after: '₹4,260', highlight: true },
                  { metric: 'Daily Average Income', before: '₹357/day', after: '₹608/day', highlight: false },
                ].map((row, i) => (
                  <div key={i} className={`grid grid-cols-3 px-6 py-3.5 border-b border-white/5 ${row.highlight ? 'bg-[#38C7D2]/10' : 'bg-white/[0.02]'}`}>
                    <p className={`text-sm font-medium ${row.highlight ? 'text-white font-bold' : 'text-blue-100/80'}`}>{row.metric}</p>
                    <p className={`text-sm text-center ${row.highlight ? 'text-red-300 font-bold' : 'text-slate-400'}`}>{row.before}</p>
                    <p className={`text-sm text-center font-bold ${row.highlight ? 'text-[#38C7D2]' : 'text-blue-100/80'} ${row.after.startsWith('+') ? 'text-emerald-400' : ''}`}>{row.after}</p>
                  </div>
                ))}

                {/* Highlight row */}
                <div className="grid grid-cols-3 px-6 py-4 bg-gradient-to-r from-[#38C7D2]/20 to-[#1E9CA4]/20 border-t border-[#38C7D2]/30">
                  <p className="text-sm font-black text-white">Status</p>
                  <div className="text-center">
                    <span className="text-xs font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">Financial Crisis</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">Stable & Secure</span>
                  </div>
                </div>
              </div>

              {/* Unicorn metric */}
              <FadeIn delay={0.2}>
                <div className="mt-6 bg-gradient-to-r from-[#38C7D2]/20 to-[#1E9CA4]/10 border border-[#38C7D2]/30 rounded-xl px-6 py-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#38C7D2]/20 flex items-center justify-center flex-shrink-0">
                    <Star className="w-6 h-6 text-[#38C7D2]" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">The Unicorn Metric</p>
                    <p className="text-blue-200 text-sm font-medium mt-0.5">
                      For <span className="text-white font-bold">less than 1%</span> of weekly income (₹40 micro-premium), Ravi{' '}
                      <span className="text-[#38C7D2] font-black">increases disaster-week take-home pay by 70%</span> —
                      completely eliminating financial ruin.
                    </p>
                  </div>
                </div>
              </FadeIn>
            </div>
          </FadeIn>
        </MaxWidth>
      </Section>

      {/* ════════════════════════════════════════════════════════
          7. TRUST & SECURITY
      ════════════════════════════════════════════════════════ */}
      <Section id="trust" className="bg-slate-50">
        <MaxWidth>
          <FadeIn className="text-center mb-12">
            <SectionTag text="Trust & Security" />
            <SectionHeading>Secure. Compliant. Transparent.</SectionHeading>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto text-base font-medium">
              Built on rigorous actuarial math, Indian regulatory compliance, and enterprise-grade technology.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                heading: '🏛️ Regulatory Compliance',
                color: 'from-amber-500 to-orange-400',
                items: [
                  { label: 'SS Code 2020 §6', desc: '90-day eligibility check enforced at payout' },
                  { label: 'DPDP Act 2023', desc: '3-point consent gate: GPS, UPI, Platform Activity' },
                  { label: '48-Hour Lockout', desc: 'Adverse selection prevention at enrollment' },
                ],
              },
              {
                heading: '🤖 AI & Tech Stack',
                color: 'from-purple-500 to-violet-400',
                items: [
                  { label: 'XGBoost Pricing', desc: 'Dynamic premium model with dual risk scoring' },
                  { label: 'IsolationForest', desc: '200-tree anomaly detection, 50/50 hybrid layer' },
                  { label: 'EfficientNet-B0', desc: 'CNN vision AI for micro-verification fallback' },
                  { label: 'Chainlink + Solidity', desc: 'On-chain payout audit trail (graceful fallback)' },
                ],
              },
              {
                heading: '💰 Financial Controls',
                color: 'from-[#254B85] to-[#38C7D2]',
                items: [
                  { label: 'BCR Monitoring', desc: 'Real-time Burning Cost Rate tracked in admin dashboard' },
                  { label: 'Razorpay Payouts', desc: 'RBI-compliant instant UPI disbursement' },
                  { label: 'Circuit Breakers', desc: 'Auto-suspend enrollments at pool critical threshold' },
                  { label: 'Twilio SMS', desc: 'Store & Forward delivery even on flaky networks' },
                ],
              },
            ].map((cat, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="bg-white rounded-2xl border border-slate-100 p-6 h-full hover:shadow-md transition-shadow">
                  <div className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide bg-gradient-to-r ${cat.color} bg-clip-text text-transparent mb-5`}>
                    {cat.heading}
                  </div>
                  <div className="space-y-3">
                    {cat.items.map((item, j) => (
                      <div key={j} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-[#38C7D2] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-slate-700">{item.label}</p>
                          <p className="text-xs text-slate-400 font-medium">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Tech logo badges */}
          <FadeIn delay={0.2} className="mt-10">
            <div className="flex flex-wrap justify-center gap-3">
              {[
                'XGBoost', 'IsolationForest', 'EfficientNet-B0', 'Razorpay',
                'Twilio', 'Chainlink', 'WAQI API', 'OpenWeatherMap', 'MongoDB Atlas', 'Expo',
              ].map((tech) => (
                <span key={tech}
                  className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-3.5 py-1.5 hover:border-teal-200 hover:text-teal-700 transition-colors">
                  {tech}
                </span>
              ))}
            </div>
          </FadeIn>
        </MaxWidth>
      </Section>

      {/* ════════════════════════════════════════════════════════
          8. FINAL CTA
      ════════════════════════════════════════════════════════ */}
      <section className="relative py-24 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0f2744] via-[#1A3668] to-[#1E9CA4]">
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#38C7D2]/10 rounded-full blur-3xl pointer-events-none" />

        <FadeIn className="text-center px-4 relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#38C7D2] to-[#1E9CA4] flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Ready to Secure Your Safety Net?
          </h2>
          <p className="text-blue-200 text-base sm:text-lg max-w-lg mx-auto font-medium mb-8">
            Join thousands of gig workers protected by Aasara AI. ₹40/week. Zero paperwork. Instant payouts.
          </p>
          <button onClick={onGetStarted}
            className="px-10 py-4 bg-gradient-to-r from-[#38C7D2] to-[#1E9CA4] hover:from-[#1E9CA4] hover:to-[#0d9488] text-white text-base font-black rounded-xl shadow-lg shadow-teal-900/30 transition-all flex items-center gap-2 mx-auto group">
            Get Covered Today
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="mt-4 text-blue-300/60 text-xs font-medium">
            No credit card required • Cancel anytime
          </p>
        </FadeIn>
      </section>

      {/* ════════════════════════════════════════════════════════
          9. FOOTER
      ════════════════════════════════════════════════════════ */}
      <footer className="bg-[#0f1f3d] border-t border-white/5 text-slate-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <AasaraLogo size="sm" className="w-9 h-9" />
                <span className="text-lg font-black text-white">Aasara AI</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-400 max-w-xs">
                Parametric micro-insurance for India's gig delivery workers. Zero-touch, instant UPI payouts.
                Built with ♥ for DEVTrails 2025.
              </p>
              <div className="flex gap-3 mt-4">
                {['Twitter', 'LinkedIn', 'GitHub'].map(s => (
                  <span key={s} className="text-xs font-semibold text-slate-500 hover:text-white transition-colors cursor-pointer">{s}</span>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4">Platform</p>
              <div className="space-y-2.5">
                {['How It Works', 'Pricing', 'Features', 'Security'].map(link => (
                  <p key={link} className="text-sm text-slate-500 hover:text-white transition-colors cursor-pointer">{link}</p>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4">Legal</p>
              <div className="space-y-2.5">
                {['Privacy Policy', 'Terms of Service', 'DPDP Compliance', 'FAQ'].map(link => (
                  <p key={link} className="text-sm text-slate-500 hover:text-white transition-colors cursor-pointer">{link}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-600">© 2026 Aasara AI. All rights reserved.</p>
            <p className="text-xs text-slate-600 text-center">
              🏆 DEVTrails Hackathon Submission — Pilot / Prototype Stage. Not yet a licensed insurer.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
