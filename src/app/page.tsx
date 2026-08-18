import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Logo from '@/components/Logo'

const services = [
  {
    code: 'ROUTE 01',
    title: 'Vehicle pickup & delivery',
    body: 'A vehicle picked up from one address and delivered to another — across town or across the province.',
  },
  {
    code: 'ROUTE 02',
    title: 'Dealer trades transport',
    body: 'Move a traded unit between dealerships, with condition photos and signatures captured at both ends.',
  },
  {
    code: 'ROUTE 03',
    title: 'New customer deliveries',
    body: 'The last mile of a sale — a freshly purchased vehicle, driven to the customer’s door.',
  },
  {
    code: 'ROUTE 04',
    title: 'Customer shuttle',
    body: 'Pick up or drop off a customer directly, timed around their service appointment or sales visit.',
  },
  {
    code: 'ROUTE 05',
    title: 'Parts & courier runs',
    body: 'Small, time-sensitive pickups and drop-offs — parts, paperwork, keys — handled the same way as everything else.',
  },
]

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#FAFAF7', color: '#14213D' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes dash-travel {
          to { stroke-dashoffset: -240; }
        }
        @keyframes dot-travel {
          0% { offset-distance: 0%; }
          100% { offset-distance: 100%; }
        }
        .route-path {
          stroke-dasharray: 10 10;
          animation: dash-travel 6s linear infinite;
        }
        .route-dot {
          offset-path: path('M20,140 C120,20 260,20 340,90 S520,200 620,90');
          animation: dot-travel 6s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .route-path, .route-dot { animation: none; }
        }
        .display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur border-b" style={{ background: 'rgba(250,250,247,0.85)', borderColor: '#E4E1D8' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo height={22} />
          <Link
            href="/login"
            className="text-sm font-semibold px-4 py-2 rounded-full border transition-colors"
            style={{ borderColor: '#14213D', color: '#14213D' }}
          >
            Log in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="mono text-xs tracking-[0.2em] mb-4" style={{ color: '#378ADD' }}>BC VEHICLE LOGISTICS NETWORK</p>
          <h1 className="display text-4xl sm:text-5xl font-semibold leading-[1.05] mb-6">
            Vehicles, customers, and parts — moved by drivers you can track the whole way.
          </h1>
          <p className="text-lg leading-relaxed mb-8" style={{ color: '#3D4A63' }}>
            Drivflo connects dealerships across British Columbia with vetted, insured drivers for every kind
            of trip a dealership needs to make — vehicle deliveries, dealer trades, customer shuttles, and
            parts runs — with live tracking on every job.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?mode=signup&role=dealer"
              className="text-sm font-semibold px-6 py-3 rounded-full text-white transition-transform hover:-translate-y-0.5"
              style={{ background: '#378ADD' }}
            >
              Sign up your dealership
            </Link>
            <Link
              href="/login?mode=signup&role=driver"
              className="text-sm font-semibold px-6 py-3 rounded-full border transition-transform hover:-translate-y-0.5"
              style={{ borderColor: '#14213D' }}
            >
              Become a driver
            </Link>
          </div>
        </div>

        {/* Signature element: animated live-route visual, referencing the product's actual GPS tracking */}
        <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: '#14213D' }}>
          <svg viewBox="0 0 640 220" className="w-full h-auto" aria-hidden="true">
            <path
              d="M20,140 C120,20 260,20 340,90 S520,200 620,90"
              fill="none"
              stroke="#2A3A5C"
              strokeWidth="3"
            />
            <path
              className="route-path"
              d="M20,140 C120,20 260,20 340,90 S520,200 620,90"
              fill="none"
              stroke="#378ADD"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="20" cy="140" r="6" fill="#F0A83C" />
            <circle cx="620" cy="90" r="6" fill="#F0A83C" />
            <circle className="route-dot" r="7" fill="#FAFAF7" />
          </svg>
          <div className="flex items-center justify-between mono text-xs mt-2" style={{ color: '#8CA3C7' }}>
            <span>PICKUP</span>
            <span>LIVE · EN ROUTE</span>
            <span>DROP-OFF</span>
          </div>
        </div>
      </section>

      {/* What is Drivflo */}
      <section className="border-t" style={{ borderColor: '#E4E1D8' }}>
        <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
          <h2 className="display text-2xl font-semibold md:col-span-1">What Drivflo is</h2>
          <div className="md:col-span-2 space-y-4 text-base leading-relaxed" style={{ color: '#3D4A63' }}>
            <p>
              Drivflo is a marketplace built specifically for automotive logistics — the trips a dealership
              runs every week that don&apos;t fit neatly into a tow truck or a courier service.
            </p>
            <p>
              Dealerships post a job with pickup and drop-off details; a nearby, background-checked driver
              claims it. Every drive includes a documented vehicle condition report, live GPS tracking the
              dealership and customer can both follow, and a digital receipt when it&apos;s done.
            </p>
          </div>
        </div>
      </section>

      {/* Services - route stops */}
      <section className="border-t" style={{ borderColor: '#E4E1D8', background: '#F3F1E9' }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="display text-2xl font-semibold mb-2">Where the route goes</h2>
          <p className="mb-12" style={{ color: '#3D4A63' }}>Five kinds of trips, one platform.</p>
          <div className="relative">
            <div className="hidden md:block absolute left-0 right-0 top-6 h-px" style={{ background: '#D7D3C4' }} />
            <div className="grid md:grid-cols-5 gap-8">
              {services.map((s) => (
                <div key={s.code} className="relative">
                  <div className="hidden md:block w-3 h-3 rounded-full mb-6" style={{ background: '#378ADD' }} />
                  <p className="mono text-[11px] tracking-wider mb-2" style={{ color: '#378ADD' }}>{s.code}</p>
                  <h3 className="font-semibold mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#3D4A63' }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dealer / Driver paths */}
      <section className="border-t" style={{ borderColor: '#E4E1D8' }}>
        <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="display text-2xl font-semibold mb-6">Signing up your dealership</h2>
            <ol className="space-y-5">
              {[
                ['Tell us about your dealership', 'Business details, dealer number, and who to contact for each drive.'],
                ['Get verified', 'We confirm your dealership so every job you post is billed correctly.'],
                ['Post your first job', 'Pickup, drop-off, vehicle details — a driver claims it, usually within minutes.'],
                ['Track it live', 'Watch the drive on a map, message the driver, and get a receipt when it’s done.'],
              ].map(([title, desc], i) => (
                <li key={title} className="flex gap-4">
                  <span className="mono text-xs mt-1 shrink-0" style={{ color: '#378ADD' }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm mt-0.5" style={{ color: '#3D4A63' }}>{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/login?mode=signup&role=dealer" className="inline-block mt-8 text-sm font-semibold px-6 py-3 rounded-full text-white" style={{ background: '#378ADD' }}>
              Sign up your dealership
            </Link>
          </div>

          <div>
            <h2 className="display text-2xl font-semibold mb-6">Becoming a driver</h2>
            <ol className="space-y-5">
              {[
                ['Apply online', 'License, driving record, and a background check — done from your phone.'],
                ['Get approved', 'Once your documents clear, your account and driver ID go live.'],
                ['Claim jobs near you', 'See available drives in your area and pick the ones that fit your schedule.'],
                ['Get paid weekly', 'Pay and any reimbursed expenses go out every week, tracked in your app.'],
              ].map(([title, desc], i) => (
                <li key={title} className="flex gap-4">
                  <span className="mono text-xs mt-1 shrink-0" style={{ color: '#F0A83C' }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm mt-0.5" style={{ color: '#3D4A63' }}>{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/login?mode=signup&role=driver" className="inline-block mt-8 text-sm font-semibold px-6 py-3 rounded-full border" style={{ borderColor: '#14213D' }}>
              Become a driver
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: '#E4E1D8' }}>
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4">
          <Logo height={18} />
          <div className="flex items-center gap-6 text-sm" style={{ color: '#3D4A63' }}>
            <Link href="/login" className="hover:underline">Log in</Link>
            <span className="mono text-xs" style={{ color: '#8C8C7E' }}>&copy; {new Date().getFullYear()} Drivflo</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
