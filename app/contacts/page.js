'use client';

import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const key = typeof window !== 'undefined' ? localStorage.getItem('bb_jobtread_grant_key') : null;
    if (!key) { setError('no_key'); setLoading(false); return; }
    try {
      const res = await fetch('/api/jobtread/contacts', { headers: { 'x-jobtread-key': key } });
      const json = await res.json();
      if (json.error) { setError(json.error); setLoading(false); return; }
      setContacts(json.contacts || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const filtered = search
    ? contacts.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
      )
    : contacts;

  return (
    <PageShell>
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Contacts</h1>
            <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '0.9em' }}>{contacts.length} contacts from JobTread</p>
          </div>
          <button onClick={load} style={styles.refreshBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Search */}
        <div style={styles.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}><div style={styles.spinner} /></div>
        ) : error === 'no_key' ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>Connect JobTread to view contacts</p>
            <a href="/setup" style={styles.setupBtn}>Go to Setup</a>
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['NAME', 'EMAIL', 'PHONE', 'JOBS', 'ADDED'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...styles.td, fontWeight: 600, color: '#f3f4f6' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={styles.avatar}>
                          {(c.name || '?')[0].toUpperCase()}
                        </div>
                        {c.name}
                      </div>
                    </td>
                    <td style={{ ...styles.td, color: '#a78bfa' }}>{c.email || '-'}</td>
                    <td style={styles.td}>{c.phone || '-'}</td>
                    <td style={styles.td}>
                      {c.jobs?.nodes?.length > 0 ? (
                        <span style={{ color: '#22c55e' }}>{c.jobs.nodes.length} job{c.jobs.nodes.length !== 1 ? 's' : ''}</span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>-</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, color: '#6b7280', fontSize: '0.85em' }}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                {search ? 'No contacts match your search' : 'No contacts found'}
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

const styles = {
  page: { padding: '28px 32px 60px', maxWidth: '1200px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontSize: '2em', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.03em' },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
    color: '#9ca3af', cursor: 'pointer', fontSize: '0.85em', fontWeight: 500,
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '10px 14px', marginBottom: '20px',
  },
  searchInput: {
    flex: 1, background: 'transparent', border: 'none', color: '#e5e7eb',
    fontSize: '0.9em', outline: 'none',
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
  avatar: {
    width: '30px', height: '30px', borderRadius: '8px',
    background: 'linear-gradient(135deg, rgba(93,71,250,0.2), rgba(139,92,246,0.2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.78em', fontWeight: 700, color: '#a78bfa', flexShrink: 0,
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
