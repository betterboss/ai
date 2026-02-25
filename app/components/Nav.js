'use client';

import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: '💬' },
  { href: '/estimate', label: 'Estimates', icon: '📋' },
  { href: '/catalog', label: 'Catalog', icon: '📦' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <span style={styles.logo}>⚡</span>
        <span style={styles.brandText}>Better Boss</span>
      </div>
      <div style={styles.links}>
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                ...styles.link,
                ...(isActive ? styles.activeLink : {}),
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    background: '#1a1a2e',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logo: {
    fontSize: '1.5em',
  },
  brandText: {
    fontWeight: 700,
    fontSize: '1.1em',
    color: '#fff',
    fontStyle: 'italic',
  },
  links: {
    display: 'flex',
    gap: '4px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '8px',
    color: '#8899a6',
    textDecoration: 'none',
    fontSize: '0.9em',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  activeLink: {
    background: 'rgba(93,71,250,0.2)',
    color: '#7a64ff',
  },
};
