'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Drivflo — For Dealerships page
// Route suggestion: app/dealers/page.tsx ("/dealers")

export default function DealersPage() {
  const router = useRouter();
  return (
    <>
<div style={{width: '100%', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflowX: 'hidden'}}>

  {/* NAV */}
  <div className="pg-nav" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb'}}>
    <Link href="/" style={{fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', flexShrink: 0}}>driv<span style={{color: '#2563eb'}}>f</span>lo</Link>
    <div className="pg-nav-links" style={{display: 'flex', gap: '36px', fontSize: '14px', fontWeight: '600'}}>
      <Link style={{color: '#2563eb'}} href="/dealers">For dealerships</Link>
      <Link className="navlink" style={{color: '#334155', fontWeight: '500'}} href="/drivers">For drivers</Link>
    </div>
    <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
      <a href="tel:18884993284" className="pg-nav-phone" style={{fontSize: '14px', color: '#334155'}}>1 888 499 3284</a>
      <Link href="/login" style={{padding: '9px 22px', border: '1px solid #cbd5e1', borderRadius: '999px', fontSize: '14px', fontWeight: '600', flexShrink: 0}}>Log in</Link>
    </div>
  </div>

  {/* HERO */}
  <div className="pg-hero" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(180deg,#f5f8fd 0%,#ffffff 100%)'}}>
    <button type="button" onClick={() => router.back()} style={{fontSize: '13px', color: '#64748b', marginBottom: '22px', background: 'none', border: 'none', padding: '0', cursor: 'pointer', fontFamily: 'inherit'}}>← Go back</button>
    <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase', marginBottom: '16px'}}>For dealerships</div>
    <div className="pg-hero-heading" style={{lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.02em'}}>
      <div>Keep your business moving.</div>
      <div style={{color: '#2563eb'}}>Get your time back.</div>
    </div>
    <div style={{maxWidth: '520px', marginTop: '18px', fontSize: '16px', color: '#475569', lineHeight: '1.55'}}>Pay only for the trips you need. Leave the driver coordination, scheduling, and tracking to us — so your team can focus on customers.</div>

    <div className="pg-hero-ctas" style={{display: 'flex', gap: '14px', marginTop: '32px'}}>
      <Link href="/dashboard/apply" style={{background: '#2563eb', color: '#ffffff', padding: '13px 26px', borderRadius: '999px', fontSize: '14px', fontWeight: '700', textAlign: 'center'}}>Register your dealership &nbsp;→</Link>
      <Link href="#services" style={{border: '1px solid #cbd5e1', color: '#0f172a', padding: '13px 26px', borderRadius: '999px', fontSize: '14px', fontWeight: '700', textAlign: 'center'}}>Explore our services</Link>
    </div>

    <div className="pg-checks" style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px 36px', marginTop: '40px', fontSize: '13px', color: '#334155', fontWeight: '500'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#2563eb'}}>✓</span> Vetted drivers</div>
      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#2563eb'}}>✓</span> Live GPS tracking</div>
      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#2563eb'}}>✓</span> Digital proof of delivery</div>
    </div>
  </div>

  {/* 3 small feature cols */}
  <div className="pg-section pg-grid-3" style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '40px', borderTop: '1px solid #e5e7eb'}}>
    <div>
      <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>01 / Less overhead</div>
      <div style={{fontSize: '17px', fontWeight: '700', marginTop: '8px'}}>Pay for what you use</div>
      <div style={{fontSize: '14px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Match driver spend to what you're moving, with none of the overhead of a dedicated transport team.</div>
    </div>
    <div>
      <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>02 / Less coordination</div>
      <div style={{fontSize: '17px', fontWeight: '700', marginTop: '8px'}}>Take logistics off your plate</div>
      <div style={{fontSize: '14px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Stop juggling drivers, schedules, and chasing updates. We handle the moving parts.</div>
    </div>
    <div>
      <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>03 / More visibility</div>
      <div style={{fontSize: '17px', fontWeight: '700', marginTop: '8px'}}>Stay in the loop</div>
      <div style={{fontSize: '14px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Follow every trip's progress from pickup to arrival, with the full history on record.</div>
    </div>
  </div>

  {/* big section */}
  <div id="services" className="pg-section" style={{background: '#f5f8fd'}}>
    <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase'}}>The details behind every delivery</div>
    <div className="pg-heading-lg" style={{fontWeight: '800', marginTop: '12px', letterSpacing: '-0.01em'}}>You made the sale.<br /><span style={{color: '#2563eb'}}>We deliver it right.</span></div>
    <div style={{fontSize: '15px', color: '#475569', maxWidth: '640px', marginTop: '16px', lineHeight: '1.6'}}>A vetted driver should feel like an extension of your dealership. Professional drivers with clean driving abstracts keep your brand front and centre, and your team stays connected the whole way through.</div>

    <div className="pg-grid-3" style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '28px', marginTop: '44px'}}>
      <div className="tile" style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', transition: 'border-color .15s'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>01 / Your fleet</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Your dealership. Every touchpoint.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>A white-label driver experience keeps the relationship where it belongs — with your dealership.</div>
      </div>
      <div className="tile" style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', transition: 'border-color .15s'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>02 / Live visibility</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Track the drive.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Follow your driver's progress from pickup to arrival with live GPS tracking.</div>
      </div>
      <div className="tile" style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', transition: 'border-color .15s'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>03 / Great chat</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Keep your team connected.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Coordinate delivery details directly with the driver through internal chat.</div>
      </div>
      <div className="tile" style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', transition: 'border-color .15s'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>04 / Customer updates</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Keep your customer in the loop.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Communicate with your customer on a dedicated line, so delivery day stays easy to follow.</div>
      </div>
      <div className="tile" style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', transition: 'border-color .15s'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>05 / Paperwork handled</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>The paperwork matters, too.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Coordinate customer approval and digital proof of delivery, all signed off at the handoff.</div>
      </div>
      <div className="tile" style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', transition: 'border-color .15s'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>06 / Great impressions</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Make a great impression, last.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Give customers an easy opportunity to leave a great review after every delivery.</div>
      </div>
    </div>

    <div className="pg-cta-banner" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0b1220', borderRadius: '16px', padding: '28px 36px', marginTop: '44px'}}>
      <div style={{fontSize: '18px', fontWeight: '700', color: '#ffffff'}}>Less chasing updates. More confidence in every delivery.</div>
      <Link href="/dashboard/apply" style={{background: '#2563eb', color: '#ffffff', padding: '12px 24px', borderRadius: '999px', fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap'}}>Talk to us about delivery &nbsp;→</Link>
    </div>
  </div>

  {/* vetted drivers */}
  <div className="pg-section" style={{}}>
    <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase'}}>The people behind every delivery</div>
    <div className="pg-heading-lg" style={{fontWeight: '800', marginTop: '12px', letterSpacing: '-0.01em'}}>Professional drivers.<br /><span style={{color: '#2563eb'}}>Thoroughly vetted.</span></div>
    <div style={{fontSize: '15px', color: '#475569', maxWidth: '620px', marginTop: '14px', lineHeight: '1.6'}}>Your vehicles, your customers, and your reputation deserve care. Every Drivflo driver goes through our vetting process before approval.</div>

    <div className="pg-grid-3" style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '36px', marginTop: '44px'}}>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>01 / License verification</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Qualified for the drive.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>02 / Driving history</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Clean driving abstracts.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>03 / Medical fitness</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Fit for the road.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>04 / Criminal background</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>A thorough background check.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>05 / Vulnerable sector</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Screening suited to the role.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>06 / Transportation standards</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Professional standards.</div>
      </div>
    </div>
  </div>

  {/* whatever needs moving */}
  <div className="pg-section" style={{background: '#f5f8fd'}}>
    <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase'}}>One platform. Every journey.</div>
    <div className="pg-heading-md" style={{fontWeight: '800', marginTop: '12px', letterSpacing: '-0.01em'}}>Whatever needs moving.</div>

    <div className="pg-grid-4" style={{display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '24px', marginTop: '36px'}}>
      <div style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px'}}>
        <div style={{fontSize: '15px', fontWeight: '700'}}>Vehicle delivery</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Dealer trades, home deliveries, and service pickups. Your vehicles, in trusted hands.</div>
      </div>
      <div style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px'}}>
        <div style={{fontSize: '15px', fontWeight: '700'}}>Customer shuttle</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>A smooth ride for customers. To the dealership, back home, or wherever they need to go.</div>
      </div>
      <div style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px'}}>
        <div style={{fontSize: '15px', fontWeight: '700'}}>Courier &amp; parts</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>The right part, in the right place. Keep your service bays and customers moving.</div>
      </div>
      <div style={{background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px'}}>
        <div style={{fontSize: '15px', fontWeight: '700'}}>Documents &amp; signing</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Paperwork delivered with care. Convenient signatures, with a clear record of the handoff.</div>
      </div>
    </div>
  </div>

  {/* getting started */}
  <div className="pg-section pg-getting-started" style={{display: 'flex', justifyContent: 'space-between', gap: '64px', alignItems: 'center'}}>
    <div style={{maxWidth: '420px'}}>
      <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase'}}>Getting started</div>
      <div className="pg-heading-md" style={{fontWeight: '800', marginTop: '12px', letterSpacing: '-0.01em'}}>Your first trip is a few steps away.</div>
    </div>
    <div style={{flex: '1', maxWidth: '520px', width: '100%', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '32px', boxSizing: 'border-box'}}>
      <div style={{fontSize: '11px', fontWeight: '700', color: '#2563eb', letterSpacing: '0.06em', textTransform: 'uppercase'}}>For dealerships</div>
      <div style={{fontSize: '18px', fontWeight: '700', marginTop: '8px'}}>Less to manage. More moving.</div>
      <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}>A week to set up your dealership and post your first trip.</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px'}}>
        <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
          <div style={{width: '22px', height: '22px', borderRadius: '999px', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'}}>1</div>
          <div style={{fontSize: '14px', fontWeight: '600'}}>Tell us about your dealership</div>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
          <div style={{width: '22px', height: '22px', borderRadius: '999px', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'}}>2</div>
          <div style={{fontSize: '14px', fontWeight: '600'}}>Post your first trip</div>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
          <div style={{width: '22px', height: '22px', borderRadius: '999px', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'}}>3</div>
          <div style={{fontSize: '14px', fontWeight: '600'}}>We'll take it from here</div>
        </div>
      </div>
      <Link href="/dashboard/apply" style={{display: 'inline-block', marginTop: '26px', background: '#2563eb', color: '#ffffff', padding: '12px 24px', borderRadius: '999px', fontSize: '14px', fontWeight: '700'}}>Register your dealership &nbsp;→</Link>
    </div>
  </div>

  {/* footer */}
  <div className="pg-footer" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb'}}>
    <Link href="/" style={{fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em'}}>driv<span style={{color: '#2563eb'}}>f</span>lo</Link>
    <div className="pg-footer-links" style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 28px', fontSize: '13px', color: '#64748b'}}>
      <Link href="/dealers">Dealerships</Link>
      <Link href="/drivers">Drivers</Link>
      <a href="tel:18884993284" style={{color: '#64748b'}}>1 888 499 3284</a>
      <div>Support</div>
      <div>Privacy</div>
      <div>© 2026 Drivflo</div>
    </div>
  </div>

</div>

      <style jsx global>{`
        .navlink:hover { color: #2563eb; }
        .tile:hover { border-color: #2563eb; }

        .pg-nav { padding: 22px 64px; }
        .pg-hero { padding: 56px 64px 48px 64px; }
        .pg-hero-heading { font-size: 46px; }
        .pg-section { padding: 56px 64px; }
        .pg-heading-lg { font-size: 34px; }
        .pg-heading-md { font-size: 32px; }
        .pg-footer { padding: 28px 64px; }

        @media (max-width: 640px) {
          .pg-nav { padding: 16px 20px; flex-wrap: wrap; row-gap: 10px; }
          .pg-nav-links { gap: 20px; order: 3; width: 100%; justify-content: center; }
          .pg-nav-phone { display: none; }
          .pg-hero { padding: 36px 20px 32px 20px; }
          .pg-hero-heading { font-size: 30px; }
          .pg-hero-ctas { flex-direction: column; width: 100%; }
          .pg-section { padding: 36px 20px; }
          .pg-grid-3 { grid-template-columns: 1fr !important; }
          .pg-grid-4 { grid-template-columns: 1fr !important; }
          .pg-heading-lg { font-size: 24px; }
          .pg-heading-md { font-size: 22px; }
          .pg-cta-banner { flex-direction: column; align-items: flex-start; gap: 18px; }
          .pg-cta-banner a { align-self: stretch; text-align: center; }
          .pg-getting-started { flex-direction: column; align-items: stretch; gap: 28px; }
          .pg-getting-started > div { max-width: none !important; }
          .pg-footer { padding: 24px 20px; flex-direction: column; gap: 16px; text-align: center; }
          .pg-footer-links { justify-content: center; }
        }
      `}</style>
    </>
  );
}
