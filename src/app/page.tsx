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
<div style={{width: '100%', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column'}}>

  {/* NAV */}
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 64px', borderBottom: '1px solid #e5e7eb'}}>
    <Link href="/" style={{fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em'}}>driv<span style={{color: '#2563eb'}}>f</span>lo</Link>
    <div style={{display: 'flex', gap: '36px', fontSize: '14px', fontWeight: '500', color: '#334155'}}>
      <Link className="navlink" href="/dealers">For dealerships</Link>
      <Link className="navlink" href="/drivers">For drivers</Link>
    </div>
    <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
      <a href="tel:18884993284" style={{fontSize: '14px', color: '#334155'}}>1 888 499 3284</a>
      <Link href="/login" style={{padding: '9px 22px', border: '1px solid #cbd5e1', borderRadius: '999px', fontSize: '14px', fontWeight: '600'}}>Log in</Link>
    </div>
  </div>

  {/* HERO */}
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '88px 64px 56px 64px', background: 'linear-gradient(180deg,#f5f8fd 0%,#ffffff 100%)'}}>
    <div style={{fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase', marginBottom: '22px'}}>Connecting BC dealerships and drivers</div>
    <div style={{fontSize: '60px', lineHeight: '1.05', fontWeight: '800', letterSpacing: '-0.02em'}}>
      <div>Every move.</div>
      <div style={{color: '#2563eb'}}>Made easy.</div>
    </div>
    <div style={{maxWidth: '520px', marginTop: '22px', fontSize: '17px', color: '#475569', lineHeight: '1.55'}}>We connect dealerships with trusted drivers. Less coordinating. More moving.</div>

    {/* two cards */}
    <div style={{display: 'flex', gap: '24px', marginTop: '48px', width: '100%', maxWidth: '920px'}}>
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
    <div style={{position: 'relative', width: '100%', maxWidth: '920px', height: '120px', marginTop: '64px'}}>
      <svg width="100%" height="120" viewBox="0 0 920 120" style={{position: 'absolute', top: '0', left: '0'}}>
        <path d="M 60 90 Q 300 10 460 60 T 860 90" fill="none" stroke="#bfdbfe" strokeWidth="2" strokeDasharray="6 6"/>
      </svg>
      <div style={{position: 'absolute', left: '0', top: '64px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 16px', boxShadow: '0 4px 10px rgba(15,23,42,0.06)', textAlign: 'left'}}>
        <div style={{fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase'}}>01 / Pickup</div>
        <div style={{fontSize: '13px', fontWeight: '600', marginTop: '2px'}}>Ready when you are</div>
      </div>
      <div style={{position: 'absolute', left: '390px', top: '0px', background: '#0b1220', borderRadius: '10px', padding: '12px 18px', boxShadow: '0 4px 10px rgba(15,23,42,0.12)', textAlign: 'left'}}>
        <div style={{fontSize: '13px', fontWeight: '700', color: '#ffffff'}}>You're in the loop</div>
        <div style={{fontSize: '12px', color: '#cbd5e1', marginTop: '2px'}}>Live tracking, all the way</div>
      </div>
      <div style={{position: 'absolute', right: '0', top: '64px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 16px', boxShadow: '0 4px 10px rgba(15,23,42,0.06)', textAlign: 'left'}}>
        <div style={{fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase'}}>03 / Delivered</div>
        <div style={{fontSize: '13px', fontWeight: '600', marginTop: '2px'}}>Right where it belongs</div>
      </div>
    </div>

    {/* checkmarks */}
    <div style={{display: 'flex', gap: '36px', marginTop: '56px', fontSize: '13px', color: '#334155', fontWeight: '500'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#2563eb'}}>✓</span> Vetted drivers</div>
      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#2563eb'}}>✓</span> Live GPS tracking</div>
      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{color: '#2563eb'}}>✓</span> Digital proof of delivery</div>
    </div>
  </div>

  {/* two column band */}
  <div style={{display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '64px', padding: '72px 64px', borderTop: '1px solid #e5e7eb'}}>
    <div>
      <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2563eb', marginBottom: '14px'}}>One partner. Every journey.</div>
      <div style={{fontSize: '34px', fontWeight: '800', lineHeight: '1.2', letterSpacing: '-0.01em'}}>From here to there.<br />Handled with care.</div>
    </div>
    <div style={{fontSize: '15px', color: '#475569', lineHeight: '1.7', alignSelf: 'center'}}>
      <p style={{margin: '0 0 14px 0'}}>Vehicles, customers, parts, and paperwork. Drivflo brings dealership transport together in one place, with vetted drivers and live tracking from pickup to delivery.</p>
      <p style={{margin: '0'}}>Whether you have a trip to book or time to drive, your next move starts here.</p>
    </div>
  </div>

  {/* footer */}
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 64px', borderTop: '1px solid #e5e7eb'}}>
    <Link href="/" style={{fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em'}}>driv<span style={{color: '#2563eb'}}>f</span>lo</Link>
    <div style={{display: 'flex', gap: '28px', fontSize: '13px', color: '#64748b'}}>
      <Link href="/dealers">Dealerships</Link>
      <Link href="/drivers">Drivers</Link>
      <a href="tel:18884993284" style={{color: '#64748b'}}>1 888 499 3284</a>
      <Link href="/support" style={{color: '#64748b'}}>Support</Link>
      <Link href="/privacy" style={{color: '#64748b'}}>Privacy</Link>
      <span>© {new Date().getFullYear()} Drivflo</span>
    </div>
  </div>

</div>

      <style jsx global>{`
        .navlink:hover { color: #2563eb; }
        .card-link:hover { transform: translateY(-2px); }
      `}</style>
    </>
  );
}
