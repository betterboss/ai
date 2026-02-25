'use client';

import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('table'); // 'pipeline' or 'table'

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const key = typeof window !== 'undefined' ? localStorage.getItem('bb_jobtread_grant_key') : null;
    if (!key) { setError('no_key'); setLoading(false); return; }
    try {
      const res = await fetch('/api/jobtread/jobs', { headers: { 'x-jobtread-key': key } });
      const json = await res.json();
      if (json.error) { setError(json.error); setLoading(false); return; }
      setJobs(json.jobs || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const totalJobs = jobs.length;
  const activeJobs = jobs.filter(j => !j.closedOn).length;
  const wonJobs = jobs.filter(j => j.status === 'won' || j.closedOn).length;
  const totalValue = jobs.reduce((s, j) => {
    const docs = j.documents?.nodes || [];
    return s + docs.reduce((ds, d) => ds + parseFloat(d.price || 0), 0);
  }, 0);

  const kpis = [
    { label: 'TOTAL JOBS', value: String(totalJobs), color: '#a78bfa' },
    { label: 'ACTIVE', value: String(activeJobs), color: '#22c55e' },
    { label: 'WON', value: String(wonJobs), color: '#38bdf8' },
    { label: 'TOTAL VALUE', value: fmt(totalValue), color: '#f59e0b' },
  ];

  // Group by status for pipeline view
  const statusGroups = {};
  jobs.forEach(j => {
    const status = j.closedOn ? 'Closed' : (j.status || 'Active');
    if (!statusGroups[status]) statusGroups[status] = [];
    statusGroups[status].push(j);
  });

  return (
    <PageShell>
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 style={styles.title}>Jobs</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={load} style={styles.refreshBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
              </svg>
              Refresh
            </button>
            <div style={styles.viewToggle}>
              <button onClick={() => setView('table')} style={{ ...styles.viewBtn, ...(view === 'table' ? styles.viewBtnActive : {}) }}>Table</button>
              <button onClick={() => setView('pipeline')} style={{ ...styles.viewBtn, ...(view === 'pipeline' ? styles.viewBtnActive : {}) }}>Pipeline</button>
            </div>
          </div>
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
          <div style={{ textAlign: 'center', padding: '60px' }}><div style={styles.spinner} /></div>
        ) : error === 'no_key' ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>Connect JobTread to view jobs</p>
            <a href="/setup" style={styles.setupBtn}>Go to Setup</a>
          </div>
        ) : view === 'table' ? (
          /* Table View */
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['#', 'NAME', 'CUSTOMER', 'STATUS', 'PROPOSALS', 'CREATED'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const docs = job.documents?.nodes || [];
                  const docValue = docs.reduce((s, d) => s + parseFloat(d.price || 0), 0);
                  return (
                    <tr key={job.id}>
                      <td style={{ ...styles.td, color: '#6b7280', fontSize: '0.85em' }}>#{job.number}</td>
                      <td style={{ ...styles.td, fontWeight: 600, color: '#f3f4f6' }}>{job.name}</td>
                      <td style={styles.td}>{job.account?.name || '-'}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          background: job.closedOn ? 'rgba(107,114,128,0.1)' : 'rgba(34,197,94,0.1)',
                          color: job.closedOn ? '#6b7280' : '#22c55e',
                        }}>
                          {job.closedOn ? 'Closed' : 'Active'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontVariantNumeric: 'tabular-nums' }}>
                        {docs.length > 0 ? `${docs.length} (${fmt(docValue)})` : '-'}
                      </td>
                      <td style={{ ...styles.td, color: '#6b7280', fontSize: '0.85em' }}>
                        {job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {jobs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>No jobs found</div>
            )}
          </div>
        ) : (
          /* Pipeline View */
          <div style={styles.pipelineWrap}>
            {Object.entries(statusGroups).map(([status, groupJobs]) => (
              <div key={status} style={styles.pipelineCol}>
                <div style={styles.pipelineHeader}>
                  <span style={{ fontWeight: 600, color: '#e5e7eb' }}>{status}</span>
                  <span style={{ color: '#6b7280', fontSize: '0.85em' }}>{groupJobs.length} jobs</span>
                </div>
                {groupJobs.slice(0, 20).map(job => (
                  <div key={job.id} style={styles.pipelineCard}>
                    <div style={{ fontWeight: 600, fontSize: '0.9em', color: '#f3f4f6', marginBottom: '2px' }}>{job.name}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.8em' }}>{job.account?.name || ''}</div>
                    {job.documents?.nodes?.length > 0 && (
                      <div style={{ color: '#22c55e', fontSize: '0.85em', fontWeight: 600, marginTop: '4px' }}>
                        {fmt(job.documents.nodes.reduce((s, d) => s + parseFloat(d.price || 0), 0))}
                      </div>
                    )}
                    <div style={{ color: '#4b5563', fontSize: '0.75em', marginTop: '4px' }}>#{job.number}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

const styles = {
  page: { padding: '28px 32px 60px', maxWidth: '1400px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '2em', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.03em' },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
    color: '#9ca3af', cursor: 'pointer', fontSize: '0.85em', fontWeight: 500,
  },
  viewToggle: {
    display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  viewBtn: {
    padding: '7px 16px', background: 'transparent', border: 'none',
    color: '#6b7280', cursor: 'pointer', fontSize: '0.85em', fontWeight: 500,
  },
  viewBtnActive: { background: 'rgba(93,71,250,0.15)', color: '#a78bfa' },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' },
  kpiCard: {
    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px', padding: '18px 20px',
  },
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
  pipelineWrap: { display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px' },
  pipelineCol: { minWidth: '260px', flex: '0 0 260px' },
  pipelineHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', marginBottom: '8px',
    background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)',
  },
  pipelineCard: {
    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', padding: '12px 14px', marginBottom: '8px',
  },
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
