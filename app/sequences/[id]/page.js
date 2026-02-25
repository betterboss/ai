'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Nav from '../../components/Nav';

const ACTION_TYPES = ['email', 'sms', 'notification'];

export default function SequenceEditorPage() {
  const { id } = useParams();
  const [sequence, setSequence] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSequence(); }, [id]);

  async function loadSequence() {
    try {
      const res = await fetch(`/api/sequences/${id}`);
      const data = await res.json();
      setSequence(data.sequence);
      setSteps(data.steps || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function addStep() {
    setSteps([...steps, {
      step_order: steps.length,
      delay_days: steps.length === 0 ? 0 : 1,
      delay_hours: 0,
      action_type: 'email',
      action_config: { subject: '', message: '' },
      conditions: {},
    }]);
  }

  function updateStep(index, updates) {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  }

  function removeStep(index) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  async function saveSteps() {
    setSaving(true);
    try {
      await fetch(`/api/sequences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: steps.map((s, i) => ({
            ...s,
            step_order: i,
            action_config: typeof s.action_config === 'string' ? JSON.parse(s.action_config) : s.action_config,
          })),
        }),
      });
      await loadSequence();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  if (loading) return <><Nav /><div style={styles.container}><p style={styles.muted}>Loading...</p></div></>;
  if (!sequence) return <><Nav /><div style={styles.container}><p style={styles.muted}>Sequence not found</p></div></>;

  return (
    <>
      <Nav />
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <a href="/sequences" style={styles.back}>&#8592; All Sequences</a>
            <h1 style={styles.title}>{sequence.name}</h1>
            <p style={styles.subtitle}>Trigger: {sequence.trigger_event || 'Manual'}</p>
          </div>
          <button onClick={saveSteps} disabled={saving} style={styles.saveBtn}>
            {saving ? 'Saving...' : 'Save Steps'}
          </button>
        </div>

        <div style={styles.timeline}>
          {steps.map((step, index) => (
            <div key={index} style={styles.stepCard}>
              <div style={styles.stepNumber}>{index + 1}</div>
              <div style={styles.stepContent}>
                <div style={styles.stepRow}>
                  <label style={styles.label}>Delay</label>
                  <input
                    type="number"
                    min="0"
                    value={step.delay_days || 0}
                    onChange={(e) => updateStep(index, { delay_days: parseInt(e.target.value) || 0 })}
                    style={{ ...styles.smallInput, width: '60px' }}
                  />
                  <span style={styles.muted}>days</span>
                  <input
                    type="number"
                    min="0"
                    value={step.delay_hours || 0}
                    onChange={(e) => updateStep(index, { delay_hours: parseInt(e.target.value) || 0 })}
                    style={{ ...styles.smallInput, width: '60px' }}
                  />
                  <span style={styles.muted}>hours</span>
                </div>
                <div style={styles.stepRow}>
                  <label style={styles.label}>Action</label>
                  <select
                    value={step.action_type}
                    onChange={(e) => updateStep(index, { action_type: e.target.value })}
                    style={styles.select}
                  >
                    {ACTION_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                {(step.action_type === 'email') && (
                  <>
                    <input
                      placeholder="Email subject"
                      value={step.action_config?.subject || ''}
                      onChange={(e) => updateStep(index, { action_config: { ...step.action_config, subject: e.target.value } })}
                      style={styles.input}
                    />
                    <textarea
                      placeholder="Email body (use {{client_name}} for variables)"
                      value={step.action_config?.message || ''}
                      onChange={(e) => updateStep(index, { action_config: { ...step.action_config, message: e.target.value } })}
                      style={styles.textarea}
                      rows={3}
                    />
                  </>
                )}
                {(step.action_type === 'sms') && (
                  <textarea
                    placeholder="SMS message (use {{client_name}} for variables)"
                    value={step.action_config?.message || ''}
                    onChange={(e) => updateStep(index, { action_config: { ...step.action_config, message: e.target.value } })}
                    style={styles.textarea}
                    rows={2}
                  />
                )}
                {(step.action_type === 'notification') && (
                  <input
                    placeholder="Notification message"
                    value={step.action_config?.message || ''}
                    onChange={(e) => updateStep(index, { action_config: { ...step.action_config, message: e.target.value } })}
                    style={styles.input}
                  />
                )}
                <button onClick={() => removeStep(index)} style={styles.removeBtn}>Remove</button>
              </div>
              {index < steps.length - 1 && <div style={styles.connector} />}
            </div>
          ))}
        </div>

        <button onClick={addStep} style={styles.addBtn}>+ Add Step</button>
      </div>
    </>
  );
}

const styles = {
  container: { maxWidth: '700px', margin: '0 auto', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' },
  back: { color: '#6b7280', fontSize: '0.85em', textDecoration: 'none', display: 'block', marginBottom: '8px' },
  title: { fontSize: '1.4em', fontWeight: 700, color: '#fff' },
  subtitle: { color: '#6b7280', fontSize: '0.85em' },
  saveBtn: { padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #5d47fa, #7a64ff)', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  muted: { color: '#6b7280', fontSize: '0.85em' },
  timeline: { display: 'flex', flexDirection: 'column', gap: '16px' },
  stepCard: { display: 'flex', gap: '16px', position: 'relative' },
  stepNumber: { width: '32px', height: '32px', borderRadius: '50%', background: '#5d47fa', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85em', flexShrink: 0 },
  stepContent: { flex: 1, background: '#12131a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  stepRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  label: { color: '#9ca3af', fontSize: '0.8em', fontWeight: 500, minWidth: '50px' },
  smallInput: { padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.85em', textAlign: 'center' },
  select: { padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.85em' },
  input: { padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.85em', width: '100%' },
  textarea: { padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.85em', width: '100%', resize: 'vertical', fontFamily: 'inherit' },
  removeBtn: { alignSelf: 'flex-end', background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75em', cursor: 'pointer' },
  connector: { position: 'absolute', left: '15px', top: '40px', bottom: '-16px', width: '2px', background: 'rgba(93,71,250,0.3)' },
  addBtn: { marginTop: '16px', padding: '10px 20px', borderRadius: '10px', border: '1px dashed rgba(93,71,250,0.4)', background: 'transparent', color: '#7a64ff', fontWeight: 500, cursor: 'pointer', width: '100%', fontSize: '0.9em' },
};
