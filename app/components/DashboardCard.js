'use client';

export default function DashboardCard({ value, label, trend, trendLabel, icon, color, onClick }) {
  const trendUp = trend > 0;
  const trendDown = trend < 0;
  const accentColor = color || '#5d47fa';

  return (
    <div
      style={{
        ...styles.card,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      data-card="true"
    >
      {icon && (
        <div style={{ ...styles.iconWrap, background: accentColor + '18', color: accentColor }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </div>
      )}
      <div style={styles.value}>{value}</div>
      <div style={styles.label}>{label}</div>
      {trend !== undefined && trend !== null && (
        <div style={{
          ...styles.trend,
          color: trendUp ? '#22c55e' : trendDown ? '#ef4444' : '#6b7280',
          background: trendUp ? 'rgba(34,197,94,0.1)' : trendDown ? 'rgba(239,68,68,0.1)' : 'rgba(107,114,128,0.1)',
        }}>
          <span style={styles.trendArrow}>
            {trendUp ? '\u2191' : trendDown ? '\u2193' : '\u2192'}
          </span>
          {Math.abs(trend).toFixed(1)}%
          {trendLabel && <span style={styles.trendLabel}> {trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '22px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  iconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  value: {
    fontSize: '1.75em',
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
  },
  label: {
    fontSize: '0.82em',
    color: '#6b7280',
    fontWeight: 500,
    marginTop: '2px',
  },
  trend: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75em',
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: '6px',
    marginTop: '8px',
    alignSelf: 'flex-start',
  },
  trendArrow: {
    fontSize: '0.9em',
  },
  trendLabel: {
    fontWeight: 400,
    opacity: 0.8,
  },
};
