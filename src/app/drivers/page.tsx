'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Drivflo — For Drivers page
// Route suggestion: app/drivers/page.tsx ("/drivers")

export default function DriversPage() {
  const router = useRouter();
  return (
    <>
<div style={{width: '100%', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column'}}>

  {/* NAV */}
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 64px', borderBottom: '1px solid #e5e7eb'}}>
    <Link href="/" style={{fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em'}}>driv<span style={{color: '#2563eb'}}>f</span>lo</Link>
    <div style={{display: 'flex', gap: '36px', fontSize: '14px', fontWeight: '600'}}>
      <Link className="navlink" style={{color: '#334155', fontWeight: '500'}} href="/dealers">For dealerships</Link>
      <Link style={{color: '#2563eb'}} href="/drivers">For drivers</Link>
    </div>
    <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
      <a href="tel:18884993284" style={{fontSize: '14px', color: '#334155'}}>1 888 499 3284</a>
      <Link href="/login" style={{padding: '9px 22px', border: '1px solid #cbd5e1', borderRadius: '999px', fontSize: '14px', fontWeight: '600'}}>Log in</Link>
    </div>
  </div>

  {/* HERO */}
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '56px 64px 48px 64px', background: 'linear-gradient(180deg,#f5f8fd 0%,#ffffff 100%)'}}>
    <button type="button" onClick={() => router.back()} style={{fontSize: '13px', color: '#64748b', marginBottom: '22px', background: 'none', border: 'none', padding: '0', cursor: 'pointer', fontFamily: 'inherit'}}>← Go back</button>
    <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase', marginBottom: '16px'}}>For drivers</div>
    <div style={{fontSize: '46px', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.02em'}}>
      <div>Your time.</div>
      <div style={{color: '#2563eb'}}>Your next trip.</div>
    </div>
    <div style={{maxWidth: '520px', marginTop: '18px', fontSize: '16px', color: '#475569', lineHeight: '1.55'}}>Help BC dealerships keep moving. Choose the available trips that fit your schedule, and get paid weekly.</div>

    <div style={{display: 'flex', gap: '14px', marginTop: '32px'}}>
      <Link href="/driver/apply" style={{background: '#2563eb', color: '#ffffff', padding: '13px 26px', borderRadius: '999px', fontSize: '14px', fontWeight: '700'}}>Become a driver &nbsp;→</Link>
      <Link href="#requirements" style={{border: '1px solid #cbd5e1', color: '#0f172a', padding: '13px 26px', borderRadius: '999px', fontSize: '14px', fontWeight: '700'}}>What you'll need</Link>
    </div>
  </div>

  {/* 3 small feature cols */}
  <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '40px', padding: '56px 64px', borderTop: '1px solid #e5e7eb'}}>
    <div>
      <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>01 / Your schedule</div>
      <div style={{fontSize: '17px', fontWeight: '700', marginTop: '8px'}}>Choose your trips</div>
      <div style={{fontSize: '14px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Browse available jobs and pick the trips that fit around your schedule.</div>
    </div>
    <div>
      <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>02 / Your route</div>
      <div style={{fontSize: '17px', fontWeight: '700', marginTop: '8px'}}>Know where you're going</div>
      <div style={{fontSize: '14px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>See the pickup and drop-off details before you accept a job, all handled through the platform.</div>
    </div>
    <div>
      <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>03 / Weekly payouts</div>
      <div style={{fontSize: '17px', fontWeight: '700', marginTop: '8px'}}>Get paid weekly</div>
      <div style={{fontSize: '14px', color: '#64748b', marginTop: '6px', lineHeight: '1.5'}}>Complete your trips and get paid weekly, straight to your account.</div>
    </div>
  </div>

  {/* vetted drivers / requirements */}
  <div id="requirements" style={{background: '#f5f8fd', padding: '72px 64px'}}>
    <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase'}}>Our driver standards</div>
    <div style={{fontSize: '32px', fontWeight: '800', marginTop: '12px', letterSpacing: '-0.01em'}}>Professional drivers.<br /><span style={{color: '#2563eb'}}>Thoroughly vetted.</span></div>
    <div style={{fontSize: '15px', color: '#475569', maxWidth: '620px', marginTop: '14px', lineHeight: '1.6'}}>Every driver completes our vetting process before approval. Here's what we look for.</div>

    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '36px', marginTop: '44px'}}>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>01 / License verification</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Qualified for the drive.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px'}}>We verify each driver's license and that it's appropriate for the job they're performing.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>02 / Driving history</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Clean driving abstracts.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px'}}>Driving records are reviewed as part of our applicant approval process.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>03 / Medical fitness</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Fit for the road.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px'}}>Medical fitness testing is part of our vetting process.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>04 / Criminal background</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>A thorough background check.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px'}}>Drivers undergo a criminal background screening before approval.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>05 / Vulnerable sector</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Screening suited to the role.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px'}}>Vulnerable sector checks are included where the role requires them.</div>
      </div>
      <div style={{borderTop: '2px solid #2563eb', paddingTop: '16px'}}>
        <div style={{fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase'}}>06 / Transportation standards</div>
        <div style={{fontSize: '16px', fontWeight: '700', marginTop: '8px'}}>Professional standards.</div>
        <div style={{fontSize: '13px', color: '#64748b', marginTop: '6px'}}>We follow Ministry of Transportation standards applicable to our operations, along with licensing and road-safety requirements.</div>
      </div>
    </div>
  </div>

  {/* getting started */}
  <div style={{padding: '72px 64px', display: 'flex', justifyContent: 'space-between', gap: '64px', alignItems: 'center'}}>
    <div style={{maxWidth: '420px'}}>
      <div style={{fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: '#2563eb', textTransform: 'uppercase'}}>How it works</div>
      <div style={{fontSize: '32px', fontWeight: '800', marginTop: '12px', letterSpacing: '-0.01em'}}>From application to your first trip.</div>
    </div>
    <div style={{flex: '1', maxWidth: '520px', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '32px'}}>
      <div style={{fontSize: '11px', fontWeight: '700', color: '#2563eb', letterSpacing: '0.06em', textTransform: 'uppercase'}}>For drivers</div>
      <div style={{fontSize: '18px', fontWeight: '700', marginTop: '8px'}}>See new places. Get paid along the way.</div>
      <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}>Discover parts of British Columbia you've never seen, with trips that fit your schedule.</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px'}}>
        <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
          <div style={{width: '22px', height: '22px', borderRadius: '999px', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'}}>1</div>
          <div style={{fontSize: '14px', fontWeight: '600'}}>Apply from your phone</div>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
          <div style={{width: '22px', height: '22px', borderRadius: '999px', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'}}>2</div>
          <div style={{fontSize: '14px', fontWeight: '600'}}>Get approved. Get going.</div>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
          <div style={{width: '22px', height: '22px', borderRadius: '999px', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'}}>3</div>
          <div style={{fontSize: '14px', fontWeight: '600'}}>Choose your trips. Get paid weekly.</div>
        </div>
      </div>
      <Link href="/driver/apply" style={{display: 'inline-block', marginTop: '26px', background: '#2563eb', color: '#ffffff', padding: '12px 24px', borderRadius: '999px', fontSize: '14px', fontWeight: '700'}}>Become a driver &nbsp;→</Link>
    </div>
  </div>

  {/* footer */}
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 64px', borderTop: '1px solid #e5e7eb'}}>
    <Link href="/" style={{fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em'}}>driv<span style={{color: '#2563eb'}}>f</span>lo</Link>
    <div style={{display: 'flex', gap: '28px', fontSize: '13px', color: '#64748b'}}>
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
      `}</style>
    </>
  );
}
