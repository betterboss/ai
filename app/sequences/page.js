'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

const TRIGGER_LABELS = {
  estimate_sent: 'Estimate Sent',
  proposal_viewed: 'Proposal Viewed',
  invoice_paid: 'Invoice Paid',
  lead_created: 'Lead Created',
  lead_lost: 'Lead Lost',
  manual: 'Manual',
};

export default function SequencesPage() {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTrigger, setNewTrigger] = useState('manual');

  const userId = typeof window !== 'undefined' ? localStorage.getItem('bb_user_id') : null;

  useEffect(() => {
    if (userId) loadSequences();
    else setLoading(false);
  }, [userId]);

  async function loadSequences() {
    try {
      const res = await fetch(`/api/sequences?userId=${userId}`);
      const data = await res.json();
      setSequences(data.sequences || []);
    } catch (e) {
      console.error('Load sequences error:', e);
    }
    setLoading(false);
  }

  async function createSequence() {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: newName, triggerEvent: newTrigger }),
      });
      if (res.ok) {
        setNewName('');
        setShowCreate(false);
        loadSequences();
      }
    } catch (e) {
      console.error('Create sequence error:', e);
    }
  }

  async function toggleActive(id, currentlyActive) {
    try {
      await fetch(`/api/sequences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentlyActive }),
      });
      loadSequences();
    } catch (e) {
      console.error('Toggle error:', e);
    }
  }

  async function deleteSequence(id) {
    if (!confirm('Delete this sequence? This cannot be undone.')) return;
    try {
      await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
      loadSequences();
    } catch (e) {
      console.error('Delete error:', e);
    }
  }

  return (
    <>
      <Nav />
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Follow-Up Sequences</h1>
            <p style={styles.subtitle}>Automated multi-touch follow-ups triggered by JobTread events</p>
          </div>
          <button onClick={() => setShowCreate(true)} style={styles.createBtn}>+ New Sequence</button>
        </div>

        {showCreate && (
          <div style={styles.createCard}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Sequence name (e.g., Estimate Follow-Up)"
              style={styles.input}
            />
            <select value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} style={styles.select}>
              {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <div style={styles.createActions}>
              <button onClick={createSequence} style={styles.saveBtn}>Create</button>
              <button onClick={() => setShowCreate(false)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={styles.muted}>Loading sequences...</p>
        ) : sequences.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No sequences yet</p>
            <p style={styles.muted}>Create your first automated follow-up sequence to never lose a deal.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {sequences.map(seq => (
              <div key={seq.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{seq.name}</h3>
                  <button
                    onClick={() => toggleActive(seq.id, seq.is_active)}
                    style={{
                      ...styles.toggleBtn,
                      background: seq.is_active ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                      color: seq.is_active ? '#34d399' : '#6b7280',
                    }}
                  >
                    {seq.is_active ? 'Active' : 'Paused'}
                  </button>
                </div>
                <div style={styles.cardMeta}>
                  <span style={styles.metaItem}>Trigger: {TRIGGER_LABELS[seq.trigger_event] || seq.trigger_event || 'Manual'}</span>
                  <span style={styles.metaItem}>{seq.step_count || 0} steps</span>
                  <span style={styles.metaItem}>{seq.active_enrollments || 0} active</span>
                </div>
                <div style={styles.cardActions}>
                  <a href={`/sequences/${seq.id}`} style={styles.editLink}>Edit Steps</a>
                  <button onClick={() => deleteSequence(seq.id)} style={styles.deleteBtn}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={styles.prebuilt}>
          <h3 style={styles.prebuiltTitle}>Pre-Built Templates</h3>
          <p style={styles.muted}>Quick-start with proven follow-up sequences.</p>
          <div style={styles.templateGrid}>
            {[
              { name: 'Estimate Follow-Up', trigger: 'estimate_sent', desc: 'Day 1, 3, 7, 14, 30 follow-ups after sending an estimate' },
              { name: 'Invoice Follow-Up', trigger: 'invoice_paid', desc: 'Payment reminders with increasing urgency' },
              { name: 'Review Request', trigger: 'invoice_paid', desc: 'Ask for reviews 24 hours after final payment' },
              { name: 'Lost Lead Revival', trigger: 'lead_lost', desc: 'Re-engage lost leads after 90 days' },
            ].map((tpl, i) => (
              <div key={i} style={styles.templateCard}>
                <h4 style={styles.templateName}>{tpl.name}</h4>
                <p style={styles.templateDesc}>{tpl.desc}</p>
                <span style={styles.templateTrigger}>{TRIGGER_LABELS[tpl.trigger]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: { maxWidth: '1000px', margin: '0 auto', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '1.5em', fontWeight: 700, color: '#fff', marginBottom: '4px' },
  subtitle: { color: '#6b7280', fontSize: '0.9em' },
  createBtn: { padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #5d47fa, #7a64ff)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9em' },
  createCard: { background: '#12131a', border: '1px solid rgba(93,71,250,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  input: { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.9em' },
  select: { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.9em' },
  createActions: { display: 'flex', gap: '8px' },
  saveBtn: { padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#5d47fa', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6b7280', cursor: 'pointer' },
  muted: { color: '#6b7280', fontSize: '0.9em' },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  emptyTitle: { fontSize: '1.1em', color: '#9ca3af', marginBottom: '8px' },
  grid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { background: '#12131a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  cardTitle: { fontSize: '1.05em', fontWeight: 600, color: '#fff' },
  toggleBtn: { padding: '4px 12px', borderRadius: '100px', border: 'none', fontSize: '0.75em', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' },
  cardMeta: { display: 'flex', gap: '16px', marginBottom: '12px' },
  metaItem: { fontSize: '0.8em', color: '#6b7280' },
  cardActions: { display: 'flex', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' },
  editLink: { color: '#7a64ff', fontSize: '0.85em', textDecoration: 'none', fontWeight: 500 },
  deleteBtn: { background: 'none', border: 'none', color: '#6b7280', fontSize: '0.85em', cursor: 'pointer' },
  prebuilt: { marginTop: '48px' },
  prebuiltTitle: { fontSize: '1.1em', fontWeight: 600, color: '#fff', marginBottom: '4px' },
  templateGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginTop: '16px' },
  templateCard: { background: '#12131a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px' },
  templateName: { fontSize: '0.95em', fontWeight: 600, color: '#e5e7eb', marginBottom: '6px' },
  templateDesc: { fontSize: '0.8em', color: '#6b7280', marginBottom: '8px' },
  templateTrigger: { fontSize: '0.7em', background: 'rgba(93,71,250,0.15)', color: '#7a64ff', padding: '3px 8px', borderRadius: '100px' },
};
