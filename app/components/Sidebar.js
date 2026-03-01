'use client';

import { usePathname } from 'next/navigation';

const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { href: '/dashboard', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { href: '/estimate', label: 'Estimates', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
      { href: '/catalog', label: 'Catalog', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    ]
  },
  {
    label: 'JOBTREAD',
    items: [
      { href: '/jobs', label: 'Jobs', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
      { href: '/invoices', label: 'Invoices', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { href: '/contacts', label: 'Contacts', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    ]
  },
  {
    label: 'SETTINGS',
    items: [
      { href: '/setup', label: 'Setup', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    ]
  },
];

function NavIcon({ path, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={styles.sidebar}>
      {/* Brand */}
      <a href="/dashboard" style={styles.brand}>
        <div style={styles.logoBox}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div>
          <span style={styles.brandText}>Better Boss</span>
          <span style={styles.brandSub}>ESTIMATOR</span>
        </div>
      </a>

      {/* Nav Sections */}
      <nav style={styles.nav}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label} style={styles.section}>
            <div style={styles.sectionLabel}>{section.label}</div>
            {section.items.map(item => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    ...styles.link,
                    ...(isActive ? styles.activeLink : {}),
                  }}
                >
                  <NavIcon path={item.icon} />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <style jsx global>{`
        .sidebar-link:hover {
          background: rgba(255,255,255,0.04) !important;
          color: #e5e7eb !important;
        }
      `}</style>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: '220px',
    minHeight: '100vh',
    background: '#0c0d14',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    overflowY: 'auto',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '18px 18px 20px',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  logoBox: {
    width: '32px',
    height: '32px',
    borderRadius: '9px',
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 2px 12px rgba(93,71,250,0.4)',
    flexShrink: 0,
  },
  brandText: {
    fontWeight: 800,
    fontSize: '0.95em',
    color: '#fff',
    display: 'block',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  brandSub: {
    fontSize: '0.58em',
    color: '#7a64ff',
    fontWeight: 600,
    letterSpacing: '1.5px',
    display: 'block',
    marginTop: '1px',
  },
  nav: {
    flex: 1,
    padding: '12px 0',
  },
  section: {
    marginBottom: '8px',
  },
  sectionLabel: {
    fontSize: '0.65em',
    fontWeight: 600,
    color: '#4b5563',
    letterSpacing: '1px',
    padding: '8px 20px 6px',
    textTransform: 'uppercase',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 20px',
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '0.88em',
    fontWeight: 500,
    transition: 'all 0.15s',
    borderLeft: '3px solid transparent',
    marginLeft: '-1px',
  },
  activeLink: {
    color: '#a78bfa',
    background: 'rgba(93,71,250,0.08)',
    borderLeftColor: '#7a64ff',
  },
};
