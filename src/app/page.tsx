import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// Drivflo — Home page, per the approved "Drivflo Website Redesign" mockup.

export default async function HomePage() {
  // Preserved from the previous homepage - a logged-in dealer/driver/admin
  // hitting the root URL should land straight in their dashboard, not see
  // the marketing page again.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <>
<div style={{width: '100%', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflowX: 'hidden'}}>

  {/* NAV */}
  <div className="hp-nav" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb'}}>
    <Link href="/" style={{fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', flexShrink: 0}}>driv<span style={{color: '#2563eb'}}>f</span>lo</Link>
    <div className="hp-nav-links" style={{display: 'flex', gap: '36px', fontSize: '14px', fontWeight: '500', color: '#334155'}}>
      <Link className="navlink" href="/dealers">For dealerships</Link>
      <Link className="navlink" href="/drivers">For drivers</Link>
    </div>
    <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
      <a href="tel:18884993284" className="hp-nav-phone" style={{fontSize: '14px', color: '#334155'}}>1 888 499 3284</a>
      <Link href="/login" style={{padding: '9px 22px', border: '1px solid #cbd5e1', borderRadius: '999px', fontSize: '14px', fontWeight: '600', flexShrink: 0}}>Log in</Link>
    </div>
  </div>

  {/* HERO */}
  <div className="hp-hero" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(180deg,#f5f8fd 0%,#ffffff 100%)'}}>
    <div style={{fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase', marginBottom: '22px'}}>Connecting BC dealerships and drivers</div>
    <div className="hp-heading" style={{lineHeight: '1.05', fontWeight: '800', letterSpacing: '-0.02em'}}>
      <div>Every move.</div>
      <div style={{color: '#2563eb'}}>Made easy.</div>
    </div>
    <div style={{maxWidth: '520px', marginTop: '22px', fontSize: '17px', color: '#475569', lineHeight: '1.55'}}>We connect dealerships with trusted drivers. Less coordinating. More moving.</div>

    {/* two cards */}
    <div className="hp-cards" style={{display: 'flex', gap: '24px', marginTop: '48px', width: '100%', maxWidth: '920px'}}>
      <Link className="card-link" href="/dealers" style={{flex: '1', display: 'block', background: '#2563eb', borderRadius: '16px', padding: '32px', textAlign: 'left', transition: 'transform .15s'}}>
        <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#bfdbfe', marginBottom: '14px'}}>Get your time back</div>
        <div style={{fontSize: '24px', fontWeight: '800', color: '#ffffff', marginBottom: '10px'}}>Become a dealer</div>
        <div style={{fontSize: '14px', color: '#dbeafe', lineHeight: '1.5', marginBottom: '28px'}}>Pay only for the trips you need. Leave the logistics to us.</div>
        <div style={{fontSize: '14px', fontWeight: '700', color: '#ffffff'}}>Explore dealership services &nbsp;→</div>
      </Link>
      <Link className="card-link" href="/drivers" style={{flex: '1', display: 'block', background: '#0b1220', borderRadius: '16px', padding: '32px', textAlign: 'left', transition: 'transform .15s'}}>
        <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '14px'}}>Your time. Your next trip.</div>
        <div style={{fontSize: '24px', fontWeight: '800', color: '#ffffff', marginBottom: '10px'}}>Become a driver</div>
        <div style={{fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '28px'}}>Choose trips that fit your schedule. Get paid weekly.</div>
        <div style={{fontSize: '14px', fontWeight: '700', color: '#ffffff'}}>Explore driving opportunities &nbsp;→</div>
      </Link>
    </div>

    {/* pickup / tracking / delivered strip */}
    <div className="hp-route" style={{position: 'relative', width: '100%', maxWidth: '920px', marginTop: '64px'}}>
      <svg width="100%" height="100%" viewBox="0 0 920 120" preserveAspectRatio="none" style={{position: 'absolute', top: '0', left: '0'}}>
        {/* Road surface */}
        <path d="M 60 90 Q 300 10 460 60 T 860 90" fill="none" stroke="#2563eb" strokeWidth="10" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        {/* Lane markings */}
        <path className="lane-dash" d="M 60 90 Q 300 10 460 60 T 860 90" fill="none" stroke="#dbeafe" strokeWidth="2" strokeDasharray="10 10" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        {/* Live-tracking car, matching the marker used on the actual job-tracking map */}
        <g className="route-car">
          <circle r="13" fill="#ffffff" stroke="#2563eb" strokeWidth="2"/>
          <g transform="scale(0.85)">
            <path d="M-9,2 L-8,-4 Q-7,-8 -3,-8 L3,-8 Q7,-8 8,-4 L9,2 Q9,5 6,5 L-6,5 Q-9,5 -9,2 Z" fill="#2563eb" stroke="#1D1D1F" strokeWidth="0.5"/>
            <path d="M-6,-3.5 L-5,-6.5 Q-4,-7.5 -2,-7.5 L2,-7.5 Q4,-7.5 5,-6.5 L6,-3.5 Z" fill="#ffffff" opacity="0.85"/>
            <circle cx="-5.5" cy="5" r="2" fill="#1D1D1F"/>
            <circle cx="5.5" cy="5" r="2" fill="#1D1D1F"/>
          </g>
        </g>
      </svg>
      <div className="hp-route-label hp-route-label-left" style={{position: 'absolute', left: '0', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 10px rgba(15,23,42,0.06)', textAlign: 'left'}}>
        <div style={{fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase'}}>01 / Pickup</div>
        <div style={{fontSize: '13px', fontWeight: '600', marginTop: '2px'}}>Ready when you are</div>
      </div>
      <div className="hp-route-label hp-route-label-mid" style={{position: 'absolute', background: '#0b1220', borderRadius: '10px', boxShadow: '0 4px 10px rgba(15,23,42,0.12)', textAlign: 'left'}}>
        <div style={{fontSize: '13px', fontWeight: '700', color: '#ffffff'}}>You&apos;re in the loop</div>
        <div style={{fontSize: '12px', color: '#cbd5e1', marginTop: '2px'}}>Live tracking, all the way</div>
      </div>
      <div className="hp-route-label hp-route-label-right" style={{position: 'absolute', right: '0', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 10px rgba(15,23,42,0.06)', textAlign: 'left'}}>
        <div style={{fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase'}}>03 / Delivered</div>
        <div style={{fontSize: '13px', fontWeight: '600', marginTop: '2px'}}>Right where it belongs</div>
      </div>
    </div>

    {/* checkmarks */}
    <div className="hp-checks" style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px 36px', marginTop: '56px', fontSize: '13px', color: '#334155', fontWeight: '500'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#2563eb'}}>✓</span> Vetted drivers</div>
      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#2563eb'}}>✓</span> Live GPS tracking</div>
      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#2563eb'}}>✓</span> Digital proof of delivery</div>
    </div>
  </div>

  {/* two column band */}
  <div className="hp-twocol" style={{display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '64px', borderTop: '1px solid #e5e7eb'}}>
    <div>
      <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2563eb', marginBottom: '14px'}}>One partner. Every journey.</div>
      <div className="hp-twocol-heading" style={{fontWeight: '800', lineHeight: '1.2', letterSpacing: '-0.01em'}}>From here to there.<br />Handled with care.</div>
    </div>
    <div style={{fontSize: '15px', color: '#475569', lineHeight: '1.7', alignSelf: 'center'}}>
      <p style={{margin: '0 0 14px 0'}}>Vehicles, customers, parts, and paperwork. Drivflo brings dealership transport together in one place, with vetted drivers and live tracking from pickup to delivery.</p>
      <p style={{margin: '0'}}>Whether you have a trip to book or time to drive, your next move starts here.</p>
    </div>
  </div>

  {/* footer */}
  <div className="hp-footer" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb'}}>
    <Link href="/" style={{fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em'}}>driv<span style={{color: '#2563eb'}}>f</span>lo</Link>
    <div className="hp-footer-links" style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 28px', fontSize: '13px', color: '#64748b'}}>
      <Link href="/dealers">Dealerships</Link>
      <Link href="/drivers">Drivers</Link>
      <a href="tel:18884993284" style={{color: '#64748b'}}>1 888 499 3284</a>
      <Link href="/support">Support</Link>
      <Link href="/privacy">Privacy</Link>
      <span>© {new Date().getFullYear()} Drivflo</span>
    </div>
  </div>

</div>

      <style>{`
        .navlink:hover { color: #2563eb; }
        .card-link:hover { transform: translateY(-2px); }
        @keyframes route-car-travel {
          0% { offset-distance: 0%; }
          100% { offset-distance: 100%; }
        }
        .route-car {
          offset-path: path('M 60 90 Q 300 10 460 60 T 860 90');
          animation: route-car-travel 6s linear infinite;
        }
        .lane-dash {
          animation: lane-dash-travel 1.2s linear infinite;
        }
        @keyframes lane-dash-travel {
          to { stroke-dashoffset: -20; }
        }
        @media (prefers-reduced-motion: reduce) {
          .route-car, .lane-dash { animation: none; offset-distance: 50%; }
        }

        /* Base (desktop) layout-critical sizing, kept out of inline styles
           specifically so it can be overridden per breakpoint below -
           inline styles always win over a plain class, so anything that
           needs to change at a smaller width has to live here instead. */
        .hp-nav { padding: 22px 64px; }
        .hp-hero { padding: 88px 64px 56px 64px; }
        .hp-heading { font-size: 60px; }
        .hp-route { height: 120px; }
        .hp-route-label { padding: 10px 16px; }
        .hp-route-label-left { top: 64px; }
        .hp-route-label-mid { left: 390px; top: 0; padding: 12px 18px; }
        .hp-route-label-right { top: 64px; }
        .hp-twocol { padding: 72px 64px; }
        .hp-twocol-heading { font-size: 34px; }
        .hp-footer { padding: 28px 64px; }

        @media (max-width: 900px) {
          .hp-route-label-mid { left: 50%; transform: translateX(-50%); }
        }

        @media (max-width: 640px) {
          .hp-nav { padding: 16px 20px; flex-wrap: wrap; row-gap: 10px; }
          .hp-nav-links { gap: 20px; order: 3; width: 100%; justify-content: center; }
          .hp-nav-phone { display: none; }
          .hp-hero { padding: 48px 20px 40px 20px; }
          .hp-heading { font-size: 34px; }
          .hp-cards { flex-direction: column; }
          .hp-route { height: 220px; }
          .hp-route-label { padding: 8px 12px; max-width: 44%; }
          .hp-route-label-left { top: auto; bottom: 0; }
          .hp-route-label-mid { top: 0; left: 50%; max-width: 60%; }
          .hp-route-label-right { top: auto; bottom: 0; }
          .hp-twocol { padding: 40px 20px; grid-template-columns: 1fr; gap: 28px; }
          .hp-twocol-heading { font-size: 26px; }
          .hp-footer { padding: 24px 20px; flex-direction: column; gap: 16px; text-align: center; }
          .hp-footer-links { justify-content: center; }
        }
      `}</style>
    </>
  );
}
