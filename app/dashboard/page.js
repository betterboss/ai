'use client';

import { useState } from 'react';
import Nav from '../components/Nav';

const ROLES = [
  {
    key: 'owner',
    label: 'Owner',
    description: 'P&L overview, revenue trends, job margins, and cash flow summary across your entire business.',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    color: '#5d47fa',
    gradient: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    href: '/dashboard/owner',
  },
  {
    key: 'sales',
    label: 'Sales',
    description: 'Pipeline value by stage, conversion rates, pending estimates, and lead tracking with kanban board.',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: '#34d399',
    gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    href: '/dashboard/sales',
  },
  {
    key: 'pm',
    label: 'Project Management',
    description: 'Daily log compliance, active tasks, overdue items, schedule metrics, and team productivity.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    href: '/dashboard/pm',
  },
  {
    key: 'accounting',
    label: 'Accounting',
    description: 'Accounts receivable aging, AR/AP breakdown, invoice summaries, and collection rate analytics.',
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    color: '#f87171',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)',
    href: '/dashboard/accounting',
  },
];

export default function DashboardHub() {
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Dashboard</h1>
            <p style={styles.subtitle}>Select a role to view real-time analytics from JobTread</p>
          </div>
          <div style={styles.quickActions}>
            <a href="/estimate/new" style={styles.quickAction}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Estimate
            </a>
            <a href="/" style={styles.quickActionChat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Agent Chat
            </a>
          </div>
        </div>

        {/* Role Cards Grid */}
        <div style={styles.grid}>
          {ROLES.map((role) => {
            const isHovered = hoveredCard === role.key;
            return (
              <a
                key={role.key}
                href={role.href}
                style={{
                  ...styles.roleCard,
                  borderColor: isHovered ? role.color + '40' : 'rgba(255,255,255,0.06)',
                  transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                  boxShadow: isHovered
                    ? `0 12px 40px ${role.color}20`
                    : '0 2px 8px rgba(0,0,0,0.2)',
                }}
                onMouseEnter={() => setHoveredCard(role.key)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Icon */}
                <div style={{ ...styles.iconWrap, background: role.gradient }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={role.icon} />
                  </svg>
                </div>

                {/* Label */}
                <h2 style={styles.roleLabel}>{role.label}</h2>

                {/* Description */}
                <p style={styles.roleDesc}>{role.description}</p>

                {/* Arrow */}
                <div style={{ ...styles.arrowRow, color: role.color }}>
                  <span style={styles.viewText}>View Dashboard</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Accent bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: role.gradient,
                  borderRadius: '14px 14px 0 0',
                  opacity: isHovered ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                }} />
              </a>
            );
          })}
        </div>

        {/* Info section */}
        <div style={styles.infoSection}>
          <div style={styles.infoIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5d47fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p style={styles.infoText}>
              Dashboards pull live data from your JobTread account. Make sure you have connected your account in{' '}
              <a href="/setup" style={styles.infoLink}>Setup</a> first.
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0b0f',
    color: '#e5e7eb',
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '32px 0 32px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '2em',
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    letterSpacing: '-0.03em',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
    fontSize: '0.9em',
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  quickAction: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: '0.82em',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  quickActionChat: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(93,71,250,0.12)',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: '8px',
    color: '#a78bfa',
    textDecoration: 'none',
    fontSize: '0.82em',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '16px',
    animation: 'fadeInUp 0.4s ease-out',
  },
  roleCard: {
    position: 'relative',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '28px 24px',
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'all 0.25s ease',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  iconWrap: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4px',
  },
  roleLabel: {
    color: '#ffffff',
    fontSize: '1.2em',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  roleDesc: {
    color: '#6b7280',
    fontSize: '0.82em',
    lineHeight: 1.5,
    margin: 0,
    flex: 1,
  },
  arrowRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    fontSize: '0.82em',
    fontWeight: 600,
  },
  viewText: {
    fontSize: '1em',
  },
  infoSection: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginTop: '32px',
    padding: '16px 20px',
    background: 'rgba(93,71,250,0.06)',
    border: '1px solid rgba(93,71,250,0.15)',
    borderRadius: '12px',
  },
  infoIcon: {
    flexShrink: 0,
    marginTop: '1px',
  },
  infoText: {
    color: '#9ca3af',
    fontSize: '0.82em',
    margin: 0,
    lineHeight: 1.5,
  },
  infoLink: {
    color: '#a78bfa',
    textDecoration: 'none',
    fontWeight: 600,
  },
};
