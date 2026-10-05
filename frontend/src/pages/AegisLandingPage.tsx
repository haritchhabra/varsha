import React, { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { motion } from 'motion/react'
import {
  ArrowRight, Shield, Radio,
  ChevronRight, Sparkles, CheckCircle, Sun, Moon,
} from 'lucide-react'
import CardSwap, { Card } from '../components/aegis/CardSwap'
import { Card1, Card2, Card3, Card4, Card5 } from '../components/aegis/LandingCards'
import BentoFeatures from '../components/aegis/BentoFeatures'
import HowItWorks from '../components/aegis/HowItWorks'
import GradientText from '../components/aegis/GradientText'
import FlipWords from '../components/aegis/FlipWords'
import RippleGrid from '../components/aegis/RippleGrid'
import TrustDonut from '../components/aegis/TrustDonut'
import MagicRings from '../components/aegis/MagicRings'
import { isAuthenticated, getUsername } from '../services/auth'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import overcastRainLottie from '../assets/overcast day-rain.lottie'
import nightRainLottie from '../assets/Weather Night - rain.lottie'
import cloudsLottie from '../assets/Clouds.lottie'



// ─── NAV ITEM WITH HOVER DROPDOWN ────────────────────────────────────────────

function NavItem({ label, items }: { label: string; items: { title: string; desc: string; href: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button style={{
        padding: '8px 14px', fontSize: 14, fontWeight: 600, color: open ? '#111827' : '#4B5563',
        background: open ? 'rgba(0,0,0,0.03)' : 'transparent',
        border: 'none', cursor: 'pointer', borderRadius: 8, transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {label}
        <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ fontSize: 10, opacity: 0.5 }}>▾</motion.span>
      </button>

      {/* Dropdown */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: 8, width: 300, padding: 8,
            background: 'white', borderRadius: 14,
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
          }}
        >
          {items.map((item, i) => (
            <a key={i} href={item.href} onClick={(e) => { e.preventDefault(); document.querySelector(item.href)?.scrollIntoView({ behavior: 'smooth' }); setOpen(false) }}
              style={{
                display: 'block', padding: '10px 14px', borderRadius: 10,
                textDecoration: 'none', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontFamily: 'Space Grotesk', marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4 }}>{item.desc}</div>
            </a>
          ))}
        </motion.div>
      )}
    </div>
  )
}

const LandingPage: React.FC = () => {
  const set = useStore(state => state.set)
  const [scrolled, setScrolled] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    // Check initial theme preference
    const saved = localStorage.getItem('aegisx-theme')
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved)
      setIsDark(saved === 'dark')
    }
  }, [])

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('aegisx-theme', next)
  }

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh', color: 'var(--text-main)', fontFamily: 'Inter, sans-serif', overflowX: 'hidden', position: 'relative' }}>
      {/* ── NAVBAR — Glassmorphic with hover mega-menu ── */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', justifyContent: 'center',
          background: scrolled ? 'rgba(248,250,255,0.92)' : 'rgba(248,250,255,0.98)',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(37,99,235,0.08)' : '1px solid rgba(37,99,235,0.06)',
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', maxWidth: 1400,
          padding: scrolled ? '12px 32px' : '16px 32px',
          transition: 'padding 0.3s ease',
        }}>
          {/* Left: Logo */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
              <Shield size={16} color="white" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#0f2044', fontFamily: 'Space Grotesk', letterSpacing: '-0.02em' }}>
              VARSHA<span style={{ color: '#2563eb', fontSize: 13 }}>'26</span>
            </span>
          </button>

          {/* Center: Nav items with hover dropdowns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <NavItem label="Intelligence" items={[
              { title: 'District Bulletin', desc: 'Hyper-local rainfall forecasts', href: '#pipeline' },
              { title: 'Regime Lab', desc: 'Synoptic weather state analysis', href: '#features' },
              { title: 'Verification', desc: 'Continuous model performance tracking', href: '#architecture' },
            ]} />
            <NavItem label="Models" items={[
              { title: 'NWP Baseline', desc: 'Raw numerical weather prediction', href: '#pipeline' },
              { title: 'AI Experts', desc: 'Regime-specific calibration models', href: '#features' },
              { title: 'Digital Twin', desc: 'Physically-based synthetic monsoon twin', href: '#architecture' },
            ]} />
            <NavItem label="Applications" items={[
              { title: 'Risk Assessment', desc: 'Predict extreme rainfall events', href: '#features' },
              { title: 'Agriculture', desc: 'District-level monsoon guidance', href: '#features' },
              { title: 'Climate Tech', desc: 'Advanced weather analytics', href: '#features' },
            ]} />
            <button onClick={() => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ padding: '8px 14px', fontSize: 14, fontWeight: 600, color: '#475569', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#1e3a5f'; e.currentTarget.style.background = 'rgba(37,99,235,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent' }}>
              Architecture
            </button>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={toggleTheme} style={{
              background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-main)', transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {isDark ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
            </button>
            {isAuthenticated() ? (
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => set({ booted: true })}
                style={{ padding: '10px 22px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#ffffff', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Dashboard <ArrowRight size={14} />
              </motion.button>
            ) : (
              <>
                <button onClick={() => set({ booted: true })}
                  style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#4B5563', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#111827'; e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#4B5563'; e.currentTarget.style.background = 'transparent' }}>
                  Sign In
                </button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => set({ booted: true })}
                  style={{ padding: '10px 22px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#ffffff', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
                  Get Started <ArrowRight size={14} />
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* ── HERO — Solid Rounded Blue Container Style ── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 100, paddingBottom: 24, paddingLeft: 24, paddingRight: 24, position: 'relative', overflow: 'hidden', zIndex: 1, background: '#ffffff' }}>

        <div style={{
          width: '100%',
          maxWidth: '100%',
          background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 35%, #1d4ed8 65%, #2563eb 100%)',
          borderRadius: 32,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          minHeight: 'calc(100vh - 124px)',
          border: '1px solid rgba(96,165,250,0.1)',
        }}>
          {/* Ambient glow orbs — cyan, indigo, sky */}
          <div style={{ position: 'absolute', top: '-15%', right: '5%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-10%', left: '0%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 60%)', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
          {/* Overlay RippleGrid — interactive grid with subtle glow on click */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <RippleGrid rows={14} cols={28} cellSize={52} color="147,197,253" />
          </div>

          <div style={{ flex: 1, padding: '60px 40px 20px', display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 24, alignItems: 'center', position: 'relative', zIndex: 2, pointerEvents: 'none' }}>
            {/* LEFT */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ pointerEvents: 'auto' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '6px 14px', marginBottom: 28 }}>
                <Sparkles size={12} color="#fff" />
                <span style={{ fontSize: 12, color: '#fff', fontFamily: 'JetBrains Mono', fontWeight: 500 }}>SIH26080 · MoES / NCMRWF</span>
              </div>

              <h1 style={{ fontSize: 'clamp(32px, 4vw, 58px)', fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
                Regime-Aware
              </h1>
              <h1 style={{ fontSize: 'clamp(32px, 4vw, 58px)', fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 24px' }}>
                <FlipWords words={['Monsoon', 'Prediction', 'Intelligence', 'Verification']} interval={2600} />
              </h1>

              <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)', lineHeight: 1.7, margin: '0 0 36px', maxWidth: 520 }}>
                VARSHA delivers hyper-localized rainfall intelligence across India's districts, powered by a 0.25° physical twin and advanced AI calibration that adapts dynamically to synoptic weather regimes.
              </p>

              {/* Input + CTA matching the image's pill shape */}
              <div style={{ display: 'flex', gap: 0, alignItems: 'center', background: '#fff', padding: 6, borderRadius: 999, width: 'fit-content', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                <input type="email" placeholder="Enter your e-mail" style={{ background: 'transparent', border: 'none', outline: 'none', color: '#111827', padding: '0 20px', fontSize: 15, width: 240, fontFamily: 'Inter' }} />
                <motion.button onClick={() => set({ booted: true })} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ background: '#3B82F6', border: 'none', color: '#fff', padding: '14px 28px', borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15 }}>
                  {isAuthenticated() ? 'Open Dashboard' : 'Get Started'} <ArrowRight size={16} />
                </motion.button>
              </div>
            </motion.div>

            {/* MIDDLE: Lottie Animations Grid */}
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.8 }}
              style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gridTemplateRows: '1fr 1fr', gap: 16, alignSelf: 'center', height: '100%', maxHeight: 520, pointerEvents: 'auto' }}>

              {/* Left Tall: overcastRainLottie */}
              <div style={{ gridColumn: '1', gridRow: '1 / span 2', background: 'var(--accent-dim)', border: '1px solid var(--border-medium)', borderRadius: 24, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                <DotLottieReact src={overcastRainLottie} loop autoplay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>

              {/* Right Top: nightRainLottie */}
              <div style={{ gridColumn: '2', gridRow: '1', background: 'var(--accent-dim)', border: '1px solid var(--border-medium)', borderRadius: 20, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                <DotLottieReact src={nightRainLottie} loop autoplay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>

              {/* Right Bottom: cloudsLottie */}
              <div style={{ gridColumn: '2', gridRow: '2', background: 'var(--accent-dim)', border: '1px solid var(--border-medium)', borderRadius: 20, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                <DotLottieReact src={cloudsLottie} loop autoplay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>

            </motion.div>

            {/* RIGHT: CardSwap */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.3 }} style={{ position: 'relative', height: 520, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 20, pointerEvents: 'auto' }}>
              <div style={{ position: 'relative', height: 500, width: '100%', maxWidth: 420 }}>
                <CardSwap width={400} height={300} cardDistance={50} verticalDistance={60} delay={4500} pauseOnHover={true} skewAmount={5}>
                  <Card><Card1 /></Card>
                  <Card><Card2 /></Card>
                  <Card><Card3 /></Card>
                  <Card><Card4 /></Card>
                  <Card><Card5 /></Card>
                </CardSwap>
              </div>
            </motion.div>
          </div>

          {/* Bottom Bar Features (Inside container, matching image bottom row layout) */}
          <div style={{ display: 'flex', justifySelf: 'center', width: '100%', maxWidth: 1100, justifyContent: 'space-between', alignItems: 'center', padding: '24px 60px', borderTop: '1px solid rgba(255,255,255,0.15)', position: 'relative', zIndex: 1, background: 'rgba(0,0,0,0.05)' }}>
            {[
              { val: '24–120h', label: 'Forecast Lead', badge: 'NWP Intelligence', icon: Sun },
              { val: '0.25°', label: 'Resolution', badge: 'High-Fidelity Grid', icon: CheckCircle },
              { val: '726', label: 'Districts', badge: 'Pan-India Coverage', icon: Radio },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', fontFamily: 'Space Grotesk' }}>{stat.badge}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-main)', marginTop: 2, fontFamily: 'Inter' }}>{stat.label}: <span style={{ fontWeight: 700, color: '#fff' }}>{stat.val}</span></div>
                  </div>
                </motion.div>
              )
            })}
          </div>

        </div>
      </section>

      {/* ── BENTO FEATURES ── */}
      <section id="features" style={{ padding: '40px 0', background: '#ffffff', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        {/* Bento Grid */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          <BentoFeatures />
        </div>
      </section>

      {/* ── HOW IT WORKS — Stepper + Donut Chart ── */}
      <section id="pipeline" style={{ padding: '80px 40px', background: '#ffffff', position: 'relative', zIndex: 1, overflow: 'hidden' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 0, maxWidth: 1360, margin: '0 auto', alignItems: 'start', position: 'relative', zIndex: 10 }}>
          <HowItWorks />
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'sticky', top: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60 }}
          >
            <TrustDonut />
          </motion.div>
        </div>
      </section>

      {/* ── INTERACTIVE DEMO — NxtDevs ChallengeTeaser style ── */}
      <section id="architecture" style={{ padding: '96px 24px', position: 'relative', overflow: 'hidden', background: '#f8fafc', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, background: 'rgba(37,99,235,0.06)', borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none' }} />

        {/* Bottom Right Credit Activation Lottie */}
        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
          style={{ position: 'absolute', bottom: -10, right: -60, width: '500px', pointerEvents: 'none', zIndex: 0 }}>
          <img src="/Business Analysis.svg" alt="Business Analysis" style={{ width: '100%', height: 'auto', opacity: 0.85 }} />
        </motion.div>

        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', position: 'relative', zIndex: 10 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', marginBottom: 24 }}>
              <Radio size={14} color="#2563eb" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', fontFamily: 'JetBrains Mono' }}>Live Pipeline</span>
            </div>

            {/* Animated corner borders around heading */}
            <div style={{ position: 'relative', padding: '20px 24px', marginBottom: 20 }}>
              {/* Top-right corner */}
              <motion.div
                animate={{ width: [0, 55, 55], height: [0, 0, 55] }}
                transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                style={{ position: 'absolute', top: 0, right: 0, borderTop: '4px solid #1d4ed8', borderRight: '4px solid #1d4ed8', borderRadius: '0 8px 0 0', pointerEvents: 'none', opacity: 0.85 }}
              />
              {/* Bottom-left corner */}
              <motion.div
                animate={{ width: [0, 50, 50], height: [0, 0, 50] }}
                transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: 1.5 }}
                style={{ position: 'absolute', bottom: 0, left: 0, borderBottom: '3.5px solid #3b82f6', borderLeft: '3.5px solid #3b82f6', borderRadius: '0 0 0 8px', pointerEvents: 'none', opacity: 0.8 }}
              />
              {/* Top-left corner */}
              <motion.div
                animate={{ width: [0, 40, 40], height: [0, 0, 40] }}
                transition={{ duration: 2.8, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: 0.8 }}
                style={{ position: 'absolute', top: 0, left: 0, borderTop: '3px solid #818cf8', borderLeft: '3px solid #818cf8', borderRadius: '8px 0 0 0', pointerEvents: 'none', opacity: 0.7 }}
              />
              {/* Bottom-right corner */}
              <motion.div
                animate={{ width: [0, 45, 45], height: [0, 0, 45] }}
                transition={{ duration: 3.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: 2 }}
                style={{ position: 'absolute', bottom: 0, right: 0, borderBottom: '3.5px solid #60a5fa', borderRight: '3.5px solid #60a5fa', borderRadius: '0 0 8px 0', pointerEvents: 'none', opacity: 0.7 }}
              />

              <h2 style={{ fontSize: 44, fontWeight: 700, color: '#111827', fontFamily: 'Space Grotesk', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
                Don't just predict.<br />
                <GradientText colors={['#06b6d4', '#3b82f6', '#2563eb', '#818cf8']} animationSpeed={6}>Verify physically.</GradientText>
              </h2>
            </div>

            <p style={{ fontSize: 16, color: '#4B5563', lineHeight: 1.7, maxWidth: 440, margin: '0 0 24px' }}>
              Most weather models output raw numerical data. VARSHA dynamically classifies synoptic regimes and applies expert AI models for enhanced, verified prediction accuracy.
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'JetBrains Mono' }}>Try the scenario →</p>
          </div>

          {/* Interactive Card */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            style={{ background: 'linear-gradient(145deg, #1e3a8a, #2563eb)', boxShadow: '0 25px 50px -12px rgba(30, 58, 138, 0.4)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden', backdropFilter: 'blur(8px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: '#93c5fd' }}>monsoon_parameters.json</span>
              <div style={{ display: 'flex', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(96,165,250,0.4)' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(147,197,253,0.4)' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(6,182,212,0.5)' }} />
              </div>
            </div>
            <pre style={{ fontFamily: 'JetBrains Mono', fontSize: 11, lineHeight: 1.8, color: '#1E3A8A', background: '#ffffff', padding: 16, borderRadius: 10, border: 'none', margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>{`{
  "nwp_rainfall_mm": 45.2,
  "convective_energy": 2850.5,
  "wind_shear_knots": 15.2,
  "geopotential_height": 5820,
  "synoptic_regime": 2
}`}</pre>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 14 }}>Which expert model should be activated?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#dbeafe' }}>Regime 1 — Break Monsoon</span>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 10, border: 'none', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#06b6d4', fontWeight: 600 }}>Regime 2 — Active Monsoon</span>
                <CheckCircle size={16} color="#06b6d4" />
              </div>
            </div>
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }}
              style={{ marginTop: 14, padding: 14, borderRadius: 10, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#67e8f9', margin: '0 0 4px' }}>Correct — AI Expert Selected</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.6 }}>
                High convective energy + mid-level trough detected → Synoptic state: ACTIVE MONSOON. The appropriate calibration expert is routed for district-level prediction.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(37,99,235,0.1)', padding: '30px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color="#2563eb" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', fontFamily: 'Space Grotesk' }}>VARSHA</span>
          <span style={{ fontSize: 12, color: '#64748B' }}>· Regime-Aware Monsoon Intelligence</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['SIH26080', 'MoES', 'NCMRWF'].map((item, i) => (
            <span key={i} style={{ fontSize: 12, color: '#64748B', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#2563eb')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}>
              {item}
            </span>
          ))}
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
