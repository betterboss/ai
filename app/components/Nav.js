'use client';

import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/estimate', label: 'Estimates', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { href: '/catalog', label: 'Catalog', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href: '/setup', label: 'Setup', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
];

function NavIcon({ path, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      <nav style={styles.nav}>
        <a href="/estimate" style={styles.brand}>
          <div style={styles.logoBox}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div>
            <span style={styles.brandText}>Better Boss</span>
            <span style={styles.brandSub}>Estimator</span>
          </div>
        </a>
        <div style={styles.links}>
          {NAV_ITEMS.map(item => {
            const isActive = pathname.startsWith(item.href);
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
                {isActive && <div style={styles.activeDot} />}
              </a>
            );
          })}
        </div>
      </nav>
      <style jsx global>{`
        @keyframes navSlideIn {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: '60px',
    background: 'linear-gradient(180deg, #12131a 0%, #0f1015 100%)',
    borderBottom: '1px solid rgba(66,133,244,0.15)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(12px)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none',
  },
  logoBox: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #4285F4, #5a9cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 2px 12px rgba(66,133,244,0.4)',
  },
  brandText: {
    fontWeight: 800,
    fontSize: '1.05em',
    color: '#fff',
    display: 'block',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  brandSub: {
    fontSize: '0.65em',
    color: '#5a9cf6',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    display: 'block',
  },
  links: {
    display: 'flex',
    gap: '2px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 16px',
    borderRadius: '8px',
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '0.88em',
    fontWeight: 500,
    transition: 'all 0.2s',
    position: 'relative',
  },
  activeLink: {
    background: 'rgba(66,133,244,0.12)',
    color: '#8ab4f8',
  },
  activeDot: {
    position: 'absolute',
    bottom: '-1px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '20px',
    height: '2px',
    borderRadius: '1px',
    background: 'linear-gradient(90deg, #4285F4, #5a9cf6)',
  },
};
