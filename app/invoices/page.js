'use client';

import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';

const STATUS_COLORS = {
  accepted: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Approved' },
  approved: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Approved' },
  pending: { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa', label: 'Pending' },
  sent: { bg: 'rgba(56,189,248,0.1)', color: '#38bdf8', label: 'Sent' },
  draft: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Draft' },
  denied: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Denied' },
  overdue: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Overdue' },
};

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const key = typeof window !== 'undefined' ? localStorage.getItem('bb_jobtread_grant_key') : null;
    if (!key) { setError('no_key'); setLoading(false); return; }
    try {
      const res = await fetch('/api/jobtread/invoices', { headers: { 'x-jobtread-key': key } });
      const json = await res.json();
      if (json.error) { setError(json.error); setLoading(false); return; }
      setInvoices(json.invoices || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const filtered = filter
    ? invoices.filter(i => {
        if (filter === 'overdue') return i.isOverdue;
        return i.status === filter;
      })
    : invoices;

  const totalInvoiced = invoices.reduce((s, i) => s + parseFloat(i.priceWithTax || i.price || 0), 0);
  const collected = invoices.reduce((s, i) => s + parseFloat(i.amountPaid || 0), 0);
  const outstanding = totalInvoiced - collected;
  const overdueCount = invoices.filter(i => i.isOverdue).length;

  const kpis = [
    { label: 'TOTAL INVOICED', value: fmt(totalInvoiced), color: '#22c55e' },
    { label: 'COLLECTED', value: fmt(collected), color: '#38bdf8' },
    { label: 'OUTSTANDING', value: fmt(outstanding), color: '#f59e0b' },
    { label: 'OVERDUE', value: String(overdueCount), color: '#ef4444' },
  ];

  return (
    <PageShell>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>Invoices</h1>
          <button onClick={load} style={styles.refreshBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div style={styles.kpiRow}>
          {kpis.map(k => (
            <div key={k.label} style={{ ...styles.kpiCard, borderTop: `3px solid ${k.color}` }}>
              <div style={{ color: k.color, fontSize: '1.6em', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
              <div style={{ color: '#6b7280', fontSize: '0.72em', fontWeight: 600, letterSpacing: '0.5px', marginTop: '4px' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={styles.spinner} />
          </div>
        ) : error === 'no_key' ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>Connect JobTread to view invoices</p>
            <a href="/setup" style={styles.setupBtn}>Go to Setup</a>
          </div>
        ) : (
          <>
            {/* Filter */}
            <div style={styles.filterRow}>
              {['', 'accepted', 'pending', 'draft', 'overdue'].map(f => (
                <button key={f} onClick={() => setFilter(f === filter ? '' : f)} style={{ ...styles.filterBtn, ...(filter === f && f ? styles.filterActive : {}) }}>
                  {f === '' ? 'All statuses' : f === 'accepted' ? 'Approved' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Table */}
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['NAME', 'JOB', 'CUSTOMER', 'STATUS', 'AMOUNT', 'PAID', 'OUTSTANDING', 'DUE'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const displayStatus = inv.isOverdue ? 'overdue' : inv.status;
                    const sc = STATUS_COLORS[displayStatus] || STATUS_COLORS.pending;
                    const amt = parseFloat(inv.priceWithTax || inv.price || 0);
                    const paid = parseFloat(inv.amountPaid || 0);
                    const owed = amt - paid;
                    return (
                      <tr key={inv.id}>
                        <td style={styles.td}>{inv.name || 'Invoice'}</td>
                        <td style={styles.td}>{inv.job?.name || '-'}</td>
                        <td style={styles.td}>{inv.account?.name || '-'}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>{sc.label}</span>
                        </td>
                        <td style={{ ...styles.td, fontVariantNumeric: 'tabular-nums' }}>{fmt(amt)}</td>
                        <td style={{ ...styles.td, color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>{fmt(paid)}</td>
                        <td style={{ ...styles.td, color: owed > 0 ? '#ef4444' : '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{fmt(owed)}</td>
                        <td style={{ ...styles.td, color: '#6b7280', fontSize: '0.85em' }}>
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>No invoices found</div>
              )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

const styles = {
  page: { padding: '28px 32px 60px', maxWidth: '1200px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '2em', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.03em' },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
    color: '#9ca3af', cursor: 'pointer', fontSize: '0.85em', fontWeight: 500,
  },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' },
  kpiCard: {
    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px', padding: '18px 20px',
  },
  filterRow: { display: 'flex', gap: '6px', marginBottom: '16px' },
  filterBtn: {
    padding: '6px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', color: '#6b7280', cursor: 'pointer', fontSize: '0.82em', fontWeight: 500,
  },
  filterActive: { background: 'rgba(93,71,250,0.12)', borderColor: 'rgba(93,71,250,0.3)', color: '#a78bfa' },
  tableWrap: {
    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88em' },
  th: {
    textAlign: 'left', padding: '12px 16px', color: '#6b7280', fontWeight: 600, fontSize: '0.75em',
    letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  td: { padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e5e7eb' },
  badge: { padding: '3px 8px', borderRadius: '6px', fontSize: '0.75em', fontWeight: 600 },
  spinner: {
    width: '32px', height: '32px', border: '3px solid rgba(93,71,250,0.2)', borderTopColor: '#5d47fa',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },
  setupBtn: {
    display: 'inline-flex', padding: '10px 22px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)', borderRadius: '10px',
    color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '0.9em',
  },
};
