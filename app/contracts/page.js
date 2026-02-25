'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

const CATEGORIES = ['delays', 'materials', 'payments', 'permits', 'changes', 'warranty', 'dispute', 'safety', 'insurance', 'termination'];

export default function ContractsPage() {
  const [clauses, setClauses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [projectType, setProjectType] = useState('');
  const [selectedConcerns, setSelectedConcerns] = useState([]);
  const [newClause, setNewClause] = useState({ title: '', category: 'payments', clauseText: '', whenToUse: '' });
  const [generating, setGenerating] = useState(false);

  const userId = typeof window !== 'undefined' ? localStorage.getItem('bb_user_id') : null;
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('bb_api_key') : null;

  useEffect(() => { loadClauses(); }, []);

  async function loadClauses() {
    try {
      const res = await fetch(`/api/contracts/clauses?userId=${userId || ''}`);
      const data = await res.json();
      setClauses(data.clauses || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function addClause() {
    if (!newClause.title || !newClause.clauseText) return;
    try {
      await fetch('/api/contracts/clauses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...newClause }),
      });
      setNewClause({ title: '', category: 'payments', clauseText: '', whenToUse: '' });
      setShowAdd(false);
      loadClauses();
    } catch (e) { console.error(e); }
  }

  async function suggestClauses() {
    if (!apiKey) return alert('Set your API key in settings first.');
    setSuggestLoading(true);
    try {
      const res = await fetch('/api/contracts/clauses/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, projectType, concerns: selectedConcerns }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (e) { console.error(e); }
    setSuggestLoading(false);
  }

  async function saveSuggestion(suggestion) {
    try {
      await fetch('/api/contracts/clauses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: suggestion.title,
          category: suggestion.category,
          clauseText: suggestion.clause_text,
          whenToUse: suggestion.when_to_use,
        }),
      });
      setSuggestions(suggestions.filter(s => s.title !== suggestion.title));
      loadClauses();
    } catch (e) { console.error(e); }
  }

  async function generateContract() {
    if (!apiKey) return alert('Set your API key first.');
    setGenerating(true);
    try {
      const selectedClauses = filteredClauses.filter(c => c.selected);
      const res = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          projectType,
          clauseIds: selectedClauses.map(c => c.id),
        }),
      });
      const data = await res.json();
      if (data.contract_html) {
        const w = window.open('', '_blank');
        w.document.write(data.contract_html);
        w.document.close();
      }
    } catch (e) { console.error(e); }
    setGenerating(false);
  }

  function toggleConcern(c) {
    setSelectedConcerns(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }

  function toggleClauseSelection(id) {
    setClauses(clauses.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  }

  const filteredClauses = activeCategory === 'all'
    ? clauses
    : clauses.filter(c => c.category === activeCategory);

  return (
    <>
      <Nav />
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Contract Clause Library</h1>
            <p style={styles.subtitle}>Manage, search, and generate contract clauses with AI assistance.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowAdd(true)} style={styles.addBtn}>+ Add Clause</button>
            <button onClick={generateContract} disabled={generating} style={styles.generateBtn}>
              {generating ? 'Generating...' : 'Generate Contract'}
            </button>
          </div>
        </div>

        {/* AI Suggest Section */}
        <div style={styles.suggestSection}>
          <h3 style={styles.sectionTitle}>AI Clause Suggestions</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              placeholder="Project type (e.g., Kitchen Remodel)"
              style={styles.input}
            />
            <button onClick={suggestClauses} disabled={suggestLoading} style={styles.suggestBtn}>
              {suggestLoading ? 'Thinking...' : 'Suggest'}
            </button>
          </div>
          <div style={styles.chipGrid}>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => toggleConcern(c)}
                style={{
                  ...styles.chip,
                  background: selectedConcerns.includes(c) ? 'rgba(93,71,250,0.2)' : 'transparent',
                  borderColor: selectedConcerns.includes(c) ? '#5d47fa' : 'rgba(255,255,255,0.1)',
                  color: selectedConcerns.includes(c) ? '#7a64ff' : '#6b7280',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {suggestions.length > 0 && (
            <div style={styles.suggestResults}>
              {suggestions.map((s, i) => (
                <div key={i} style={styles.suggestCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={styles.clauseTitle}>{s.title}</h4>
                    <button onClick={() => saveSuggestion(s)} style={styles.saveClauseBtn}>Save</button>
                  </div>
                  <span style={styles.categoryBadge}>{s.category}</span>
                  <p style={styles.clauseText}>{s.clause_text}</p>
                  <p style={styles.whenToUse}>{s.when_to_use}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Clause Form */}
        {showAdd && (
          <div style={styles.addForm}>
            <input value={newClause.title} onChange={(e) => setNewClause({ ...newClause, title: e.target.value })} placeholder="Clause title" style={styles.input} />
            <select value={newClause.category} onChange={(e) => setNewClause({ ...newClause, category: e.target.value })} style={styles.select}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <textarea value={newClause.clauseText} onChange={(e) => setNewClause({ ...newClause, clauseText: e.target.value })} placeholder="Clause text" style={styles.textarea} rows={3} />
            <input value={newClause.whenToUse} onChange={(e) => setNewClause({ ...newClause, whenToUse: e.target.value })} placeholder="When to use this clause" style={styles.input} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={addClause} style={styles.saveBtn}>Save Clause</button>
              <button onClick={() => setShowAdd(false)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div style={styles.filterRow}>
          <button onClick={() => setActiveCategory('all')} style={{ ...styles.filterBtn, ...(activeCategory === 'all' ? styles.filterActive : {}) }}>All ({clauses.length})</button>
          {CATEGORIES.map(c => {
            const count = clauses.filter(cl => cl.category === c).length;
            if (count === 0) return null;
            return (
              <button key={c} onClick={() => setActiveCategory(c)} style={{ ...styles.filterBtn, ...(activeCategory === c ? styles.filterActive : {}) }}>
                {c.charAt(0).toUpperCase() + c.slice(1)} ({count})
              </button>
            );
          })}
        </div>

        {/* Clause List */}
        {loading ? (
          <p style={styles.muted}>Loading clauses...</p>
        ) : filteredClauses.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>No clauses yet</p>
            <p style={styles.muted}>Add clauses manually or use AI to suggest clauses for your projects.</p>
          </div>
        ) : (
          <div style={styles.clauseList}>
            {filteredClauses.map(clause => (
              <div key={clause.id} style={{ ...styles.clauseCard, borderColor: clause.selected ? '#5d47fa' : 'rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="checkbox" checked={!!clause.selected} onChange={() => toggleClauseSelection(clause.id)} />
                    <h4 style={styles.clauseTitle}>{clause.title}</h4>
                  </div>
                  <span style={styles.categoryBadge}>{clause.category}</span>
                </div>
                <p style={styles.clauseText}>{clause.clause_text}</p>
                {clause.when_to_use && <p style={styles.whenToUse}>{clause.when_to_use}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  container: { maxWidth: '1000px', margin: '0 auto', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '1.5em', fontWeight: 700, color: '#fff', marginBottom: '4px' },
  subtitle: { color: '#6b7280', fontSize: '0.9em' },
  addBtn: { padding: '10px 20px', borderRadius: '10px', border: '1px dashed rgba(93,71,250,0.4)', background: 'transparent', color: '#7a64ff', fontWeight: 500, cursor: 'pointer', fontSize: '0.85em' },
  generateBtn: { padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #5d47fa, #7a64ff)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.85em' },
  suggestSection: { background: '#12131a', border: '1px solid rgba(93,71,250,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '24px' },
  sectionTitle: { fontSize: '1em', fontWeight: 600, color: '#fff', marginBottom: '12px' },
  input: { flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.9em' },
  select: { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.9em' },
  textarea: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.9em', resize: 'vertical', fontFamily: 'inherit' },
  suggestBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#5d47fa', color: '#fff', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  chipGrid: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' },
  chip: { padding: '4px 12px', borderRadius: '100px', border: '1px solid', fontSize: '0.8em', cursor: 'pointer', textTransform: 'capitalize' },
  suggestResults: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' },
  suggestCard: { background: 'rgba(93,71,250,0.05)', border: '1px solid rgba(93,71,250,0.15)', borderRadius: '10px', padding: '14px' },
  saveClauseBtn: { padding: '4px 12px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.75em', fontWeight: 600, cursor: 'pointer' },
  addForm: { background: '#12131a', border: '1px solid rgba(93,71,250,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  saveBtn: { padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#5d47fa', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6b7280', cursor: 'pointer' },
  filterRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' },
  filterBtn: { padding: '6px 14px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6b7280', fontSize: '0.8em', cursor: 'pointer' },
  filterActive: { background: 'rgba(93,71,250,0.15)', borderColor: '#5d47fa', color: '#7a64ff' },
  muted: { color: '#6b7280', fontSize: '0.9em' },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  emptyTitle: { fontSize: '1.1em', color: '#9ca3af', marginBottom: '8px' },
  clauseList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  clauseCard: { background: '#12131a', border: '1px solid', borderRadius: '12px', padding: '16px' },
  clauseTitle: { fontSize: '0.95em', fontWeight: 600, color: '#fff' },
  categoryBadge: { fontSize: '0.7em', background: 'rgba(93,71,250,0.15)', color: '#7a64ff', padding: '2px 8px', borderRadius: '100px', textTransform: 'capitalize', display: 'inline-block', marginTop: '4px' },
  clauseText: { color: '#d1d5db', fontSize: '0.85em', lineHeight: 1.6, marginTop: '8px' },
  whenToUse: { color: '#6b7280', fontSize: '0.8em', fontStyle: 'italic', marginTop: '6px' },
};
