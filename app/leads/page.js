'use client';

import { useState, useEffect, useCallback } from 'react';
import Nav from '../components/Nav';

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'converted', 'lost'];

const STATUS_COLORS = {
  new:       { bg: 'rgba(56,189,248,0.1)',  color: '#38bdf8', border: 'rgba(56,189,248,0.25)' },
  contacted: { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  qualified: { bg: 'rgba(139,92,246,0.1)',  color: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
  converted: { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  lost:      { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

const SOURCE_COLORS = {
  angi:        { bg: 'rgba(255,87,34,0.12)',  color: '#ff5722' },
  thumbtack:   { bg: 'rgba(0,150,136,0.12)',  color: '#009688' },
  homeadvisor: { bg: 'rgba(255,152,0,0.12)',  color: '#ff9800' },
  gmail:       { bg: 'rgba(234,67,53,0.12)',  color: '#ea4335' },
  google_maps: { bg: 'rgba(66,133,244,0.12)', color: '#4285f4' },
  facebook:    { bg: 'rgba(24,119,242,0.12)', color: '#1877f2' },
  manual:      { bg: 'rgba(156,163,175,0.12)', color: '#9ca3af' },
  extension:   { bg: 'rgba(93,71,250,0.12)',  color: '#5d47fa' },
};

export default function LeadsDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pushingId, setPushingId] = useState(null);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    loadLeads();
  }, [filterStatus, filterSource]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterSource) params.set('source', filterSource);
      params.set('limit', '200');

      const res = await fetch('/api/leads?' + params.toString());
      const data = await res.json();

      if (data.error && data.error.includes('DATABASE_URL')) {
        setDbError(true);
        return;
      }

      setLeads(data.leads || []);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (id, newStatus) => {
    try {
      const res = await fetch('/api/leads/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.lead) {
        setLeads(prev => prev.map(l => l.id === id ? data.lead : l));
      }
    } catch (err) {
      console.error('Failed to update lead status:', err);
    }
  };

  const pushToJobTread = async (id) => {
    const grantKey = localStorage.getItem('bb_grantKey') || prompt('Enter your JobTread grant key:');
    if (!grantKey) return;

    localStorage.setItem('bb_grantKey', grantKey);
    setPushingId(id);

    try {
      const res = await fetch('/api/leads/' + id + '/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantKey }),
      });
      const data = await res.json();

      if (res.ok && data.lead) {
        setLeads(prev => prev.map(l => l.id === id ? data.lead : l));
      } else {
        alert('Failed to push to JobTread: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Network error pushing to JobTread: ' + err.message);
    } finally {
      setPushingId(null);
    }
  };

  const deleteLead = async (id) => {
    if (!confirm('Delete this lead?')) return;
    try {
      await fetch('/api/leads/' + id, { method: 'DELETE' });
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error('Failed to delete lead:', err);
    }
  };

  // Filter by search query (client-side)
  const filteredLeads = leads.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q)) ||
      (l.address && l.address.toLowerCase().includes(q)) ||
      (l.job_description && l.job_description.toLowerCase().includes(q))
    );
  });

  // Stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0.0';

  // Source breakdown
  const sourceCounts = {};
  leads.forEach(l => {
    const s = l.source || 'unknown';
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  });

  const stats = [
    { label: 'Total Leads', value: String(totalLeads), icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: '#5d47fa' },
    { label: 'New', value: String(newLeads), icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6', color: '#38bdf8' },
    { label: 'Converted', value: String(convertedLeads), icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: '#22c55e' },
    { label: 'Conversion Rate', value: conversionRate + '%', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', color: '#a78bfa' },
  ];

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Database Error */}
        {dbError && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', fontSize: '1.3em', fontWeight: 700, margin: '0 0 8px' }}>Database Not Connected</h2>
            <p style={{ color: '#6b7280', fontSize: '0.9em', margin: '0 0 24px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              Add a Neon Postgres database to your Vercel project, then redeploy.
            </p>
            <a href="/setup" style={styles.actionBtn}>Go to Setup</a>
          </div>
        )}

        {!dbError && <>
          {/* Hero Header */}
          <div style={styles.hero}>
            <div style={styles.heroContent}>
              <div style={styles.heroLeft}>
                <h1 style={styles.heroTitle}>Leads</h1>
                <p style={styles.heroSub}>Capture, track, and convert leads to JobTread jobs</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div style={styles.statsRow}>
              {stats.map((stat, i) => (
                <div key={i} style={styles.statCard}>
                  <div style={{ ...styles.statIcon, background: stat.color + '15', color: stat.color }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={stat.icon} />
                    </svg>
                  </div>
                  <div>
                    <div style={styles.statValue}>{stat.value}</div>
                    <div style={styles.statLabel}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source Breakdown */}
          {Object.keys(sourceCounts).length > 0 && (
            <div style={styles.sourceBreakdown}>
              <div style={styles.sourceBreakdownLabel}>Sources</div>
              <div style={styles.sourceChips}>
                {Object.entries(sourceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => {
                    const sc = SOURCE_COLORS[src] || SOURCE_COLORS.manual;
                    const isActive = filterSource === src;
                    return (
                      <button
                        key={src}
                        onClick={() => setFilterSource(isActive ? '' : src)}
                        style={{
                          ...styles.sourceChip,
                          background: isActive ? sc.color : sc.bg,
                          color: isActive ? '#fff' : sc.color,
                          borderColor: sc.color + '40',
                        }}
                      >
                        {src.replace('_', ' ')}
                        <span style={styles.sourceCount}>{count}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Filters Row */}
          <div style={styles.filterRow}>
            <div style={styles.filterButtons}>
              {['', ...STATUS_OPTIONS].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  style={{
                    ...styles.filterBtn,
                    ...(filterStatus === f ? styles.filterActive : {}),
                  }}
                >
                  {f === '' ? 'All' : f}
                </button>
              ))}
            </div>
            <div style={styles.searchWrap}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>
          </div>

          {/* Lead List */}
          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Loading leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIconWrap}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#4b5563' }}>
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 style={styles.emptyTitle}>No leads yet</h3>
              <p style={styles.emptyText}>
                Leads captured from the Chrome extension or added manually will appear here.
              </p>
            </div>
          ) : (
            <div style={styles.list}>
              {filteredLeads.map(lead => {
                const statusStyle = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
                const sourceStyle = SOURCE_COLORS[lead.source] || SOURCE_COLORS.manual;
                const isConverted = !!lead.jobtread_job_id;
                const isPushing = pushingId === lead.id;

                return (
                  <div key={lead.id} style={styles.card}>
                    <div style={styles.cardMain}>
                      <div style={styles.cardHeader}>
                        <div style={styles.cardNameRow}>
                          <span style={styles.cardName}>{lead.name}</span>
                          <span style={{
                            ...styles.sourceBadge,
                            background: sourceStyle.bg,
                            color: sourceStyle.color,
                          }}>
                            {(lead.source || 'unknown').replace('_', ' ')}
                          </span>
                        </div>
                        <div style={styles.cardActions}>
                          <select
                            value={lead.status || 'new'}
                            onChange={e => updateLeadStatus(lead.id, e.target.value)}
                            style={{
                              ...styles.statusSelect,
                              background: statusStyle.bg,
                              color: statusStyle.color,
                              borderColor: statusStyle.border,
                            }}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => deleteLead(lead.id)}
                            style={styles.deleteBtn}
                            title="Delete lead"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div style={styles.cardDetails}>
                        {lead.phone && (
                          <span style={styles.cardDetail}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {lead.phone}
                          </span>
                        )}
                        {lead.email && (
                          <span style={styles.cardDetail}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {lead.email}
                          </span>
                        )}
                        {lead.address && (
                          <span style={styles.cardDetail}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {lead.address}
                          </span>
                        )}
                      </div>

                      {lead.job_description && (
                        <p style={styles.cardDescription}>{lead.job_description}</p>
                      )}

                      <div style={styles.cardFooter}>
                        <span style={styles.cardDate}>
                          {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>

                        {isConverted ? (
                          <span style={styles.jtBadge}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            In JobTread
                          </span>
                        ) : (
                          <button
                            onClick={() => pushToJobTread(lead.id)}
                            disabled={isPushing}
                            style={{
                              ...styles.pushBtn,
                              opacity: isPushing ? 0.6 : 1,
                              cursor: isPushing ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isPushing ? (
                              <>
                                <div style={styles.pushSpinner} />
                                Pushing...
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                </svg>
                                Push to JobTread
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0b0f',
    color: '#e5e7eb',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  hero: {
    padding: '32px 0 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '20px',
  },
  heroContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  heroLeft: {},
  heroTitle: {
    fontSize: '2em',
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: '-0.03em',
  },
  heroSub: {
    color: '#6b7280',
    margin: '4px 0 0',
    fontSize: '0.9em',
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.9em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#12131a',
    borderRadius: '12px',
    padding: '14px 16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  statIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: {
    fontSize: '1.25em',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '0.75em',
    color: '#6b7280',
    marginTop: '1px',
  },
  // Source breakdown
  sourceBreakdown: {
    marginBottom: '20px',
    padding: '16px',
    background: '#12131a',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  sourceBreakdownLabel: {
    fontSize: '0.7em',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '10px',
  },
  sourceChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  sourceChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '8px',
    fontSize: '0.8em',
    fontWeight: 600,
    border: '1px solid',
    cursor: 'pointer',
    textTransform: 'capitalize',
    transition: 'all 0.15s',
  },
  sourceCount: {
    fontSize: '0.85em',
    opacity: 0.7,
  },
  // Filters
  filterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  filterButtons: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '0.82em',
    fontWeight: 500,
    textTransform: 'capitalize',
    transition: 'all 0.15s',
  },
  filterActive: {
    background: 'rgba(93,71,250,0.12)',
    borderColor: 'rgba(93,71,250,0.3)',
    color: '#a78bfa',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '6px 12px',
    minWidth: '220px',
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#e5e7eb',
    fontSize: '0.85em',
    width: '100%',
  },
  // Lead list
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    background: '#12131a',
    borderRadius: '12px',
    padding: '16px 20px',
    border: '1px solid rgba(255,255,255,0.06)',
    transition: 'all 0.2s',
    animation: 'cardIn 0.3s ease-out',
  },
  cardMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  cardNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontWeight: 600,
    fontSize: '1em',
    color: '#f3f4f6',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sourceBadge: {
    padding: '2px 8px',
    borderRadius: '5px',
    fontSize: '0.68em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  statusSelect: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.72em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    border: '1px solid',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'auto',
  },
  deleteBtn: {
    padding: '6px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    color: '#4b5563',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
  },
  cardDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
  },
  cardDetail: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    color: '#9ca3af',
    fontSize: '0.82em',
  },
  cardDescription: {
    color: '#6b7280',
    fontSize: '0.85em',
    lineHeight: 1.5,
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
  },
  cardDate: {
    color: '#6b7280',
    fontSize: '0.78em',
  },
  jtBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    background: 'rgba(34,197,94,0.1)',
    borderRadius: '6px',
    color: '#22c55e',
    fontSize: '0.75em',
    fontWeight: 600,
  },
  pushBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.78em',
    fontWeight: 600,
    border: 'none',
    boxShadow: '0 2px 8px rgba(93,71,250,0.3)',
    transition: 'all 0.15s',
  },
  pushSpinner: {
    width: '12px',
    height: '12px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  // Loading
  loadingWrap: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(93,71,250,0.2)',
    borderTopColor: '#5d47fa',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '0.9em',
  },
  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  emptyIconWrap: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  emptyTitle: {
    color: '#e5e7eb',
    margin: '0 0 8px',
    fontSize: '1.2em',
    fontWeight: 600,
  },
  emptyText: {
    color: '#6b7280',
    margin: '0 0 24px',
    fontSize: '0.9em',
    maxWidth: '400px',
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: 1.5,
  },
};
