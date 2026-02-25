'use client';

import { useState, useEffect, useRef } from 'react';
import Nav from '../components/Nav';

const CATEGORIES = ['material', 'labor', 'equipment', 'subcontractor'];
const CATEGORY_COLORS = {
  material: '#a78bfa',
  labor: '#22c55e',
  equipment: '#f59e0b',
  subcontractor: '#ef4444',
};

export default function CatalogManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', category: 'material', unit: 'each', unit_cost: '', markup_pct: '', supplier: '' });
  const [importData, setImportData] = useState('');
  const [syncingJT, setSyncingJT] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    loadItems();
  }, [filter]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('category', filter);
      const res = await fetch('/api/catalog?' + params.toString());
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) throw new Error('Failed to add item');
      setNewItem({ name: '', description: '', category: 'material', unit: 'each', unit_cost: '', markup_pct: '', supplier: '' });
      setShowAdd(false);
      loadItems();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteItem = async (id) => {
    if (!confirm('Delete this catalog item?')) return;
    await fetch(`/api/catalog?id=${id}`, { method: 'DELETE' });
    loadItems();
  };

  const handleCSVImport = async () => {
    if (!importData.trim()) return;

    try {
      const lines = importData.trim().split('\n');
      if (lines.length < 2) {
        alert('CSV needs a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });
        return obj;
      });

      const res = await fetch('/api/catalog/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Imported ${data.imported} items!`);
      setShowImport(false);
      setImportData('');
      loadItems();
    } catch (err) {
      alert(err.message);
    }
  };

  const syncFromJobTread = async () => {
    const grantKey = localStorage.getItem('bb_jobtread_grant_key');
    if (!grantKey) {
      alert('Set your JobTread grant key in the Estimate Editor settings first.');
      return;
    }

    setSyncingJT(true);
    try {
      const res = await fetch('/api/catalog/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Synced ${data.synced} cost codes from JobTread (${data.total_cost_codes} total)`);
      loadItems();
    } catch (err) {
      alert(err.message);
    } finally {
      setSyncingJT(false);
    }
  };

  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || (i.description || '').toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Hero Header */}
        <div style={styles.hero}>
          <div style={styles.heroContent}>
            <div>
              <h1 style={styles.title}>Cost Catalog</h1>
              <p style={styles.subtitle}>Manage your materials, labor rates, and cost items</p>
            </div>
            <div style={styles.headerActions}>
              <button onClick={syncFromJobTread} disabled={syncingJT} style={styles.secondaryBtn}>
                {syncingJT ? (
                  <><div style={styles.btnSpinner} /> Syncing...</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync from JobTread
                  </>
                )}
              </button>
              <button onClick={() => setShowImport(!showImport)} style={styles.secondaryBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Import CSV
              </button>
              <button onClick={() => setShowAdd(!showAdd)} style={styles.primaryBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Item
              </button>
            </div>
          </div>
        </div>

        {/* Search + Filter */}
        <div style={styles.searchRow}>
          <div style={styles.searchWrap}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              style={styles.searchInput}
              placeholder="Search catalog..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={styles.filterRow}>
            <button onClick={() => setFilter('')} style={{ ...styles.filterBtn, ...(!filter ? styles.filterActive : {}) }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  ...styles.filterBtn,
                  ...(filter === cat ? { ...styles.filterActive, borderColor: CATEGORY_COLORS[cat], color: CATEGORY_COLORS[cat], background: `${CATEGORY_COLORS[cat]}12` } : {}),
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CATEGORY_COLORS[cat], display: 'inline-block', marginRight: '4px' }} />
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Import CSV Panel */}
        {showImport && (
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>Import from CSV</h3>
              <button onClick={() => setShowImport(false)} style={styles.panelClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p style={styles.panelHint}>
              Paste CSV data with columns: name, description, category, unit, unit_cost, markup_pct, supplier
            </p>
            <textarea
              style={styles.textarea}
              rows={8}
              placeholder={'name,category,unit,unit_cost,markup_pct\nDrywall 1/2",material,sheet,12.50,25\nElectrician,labor,hour,85.00,20'}
              value={importData}
              onChange={e => setImportData(e.target.value)}
            />
            <button onClick={handleCSVImport} style={styles.primaryBtn}>Import</button>
          </div>
        )}

        {/* Add Item Form */}
        {showAdd && (
          <form onSubmit={addItem} style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}>Add Catalog Item</h3>
              <button type="button" onClick={() => setShowAdd(false)} style={styles.panelClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.formGrid}>
              <input style={styles.input} placeholder="Item name *" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} autoFocus />
              <select style={styles.input} value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input style={styles.input} placeholder="Unit (sqft, each, hour...)" value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} />
              <input style={styles.input} type="number" step="0.01" placeholder="Unit cost" value={newItem.unit_cost} onChange={e => setNewItem({ ...newItem, unit_cost: e.target.value })} />
              <input style={styles.input} type="number" placeholder="Markup %" value={newItem.markup_pct} onChange={e => setNewItem({ ...newItem, markup_pct: e.target.value })} />
              <input style={styles.input} placeholder="Supplier (optional)" value={newItem.supplier} onChange={e => setNewItem({ ...newItem, supplier: e.target.value })} />
            </div>
            <input style={{ ...styles.input, marginTop: '8px' }} placeholder="Description (optional)" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
            <button type="submit" style={{ ...styles.primaryBtn, marginTop: '12px', width: '100%', justifyContent: 'center' }}>Add Item</button>
          </form>
        )}

        {/* Items Count */}
        <div style={styles.itemCount}>{filtered.length} items</div>

        {/* Items List */}
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={{ color: '#6b7280', fontSize: '0.9em' }}>Loading catalog...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#4b5563' }}>
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 style={styles.emptyTitle}>No catalog items yet</h3>
            <p style={styles.emptyText}>Add items manually, import from CSV, or sync from JobTread.</p>
            <button onClick={() => setShowAdd(true)} style={styles.primaryBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add First Item
            </button>
          </div>
        ) : (
          <div style={styles.list}>
            {filtered.map(item => {
              const catColor = CATEGORY_COLORS[item.category] || '#a78bfa';
              return (
                <div key={item.id} style={styles.itemCard}>
                  <div style={styles.itemTop}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={styles.itemName}>{item.name}</span>
                      {item.description && <span style={styles.itemDesc}> — {item.description}</span>}
                    </div>
                    <button onClick={() => deleteItem(item.id)} style={styles.deleteBtn} title="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div style={styles.itemBottom}>
                    <span style={{ ...styles.catBadge, background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}30` }}>
                      {item.category}
                    </span>
                    <span style={styles.itemMeta}>${parseFloat(item.unit_cost || 0).toFixed(2)} / {item.unit}</span>
                    {item.markup_pct > 0 && <span style={styles.itemMarkup}>+{item.markup_pct}%</span>}
                    {item.supplier && <span style={styles.itemMeta}>{item.supplier}</span>}
                    {item.jobtread_cost_code_id && (
                      <span style={styles.jtBadge}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        JT
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
    maxWidth: '960px',
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontSize: '2em',
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
    fontSize: '0.9em',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 18px',
    background: 'linear-gradient(135deg, #5d47fa, #7c3aed)',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.88em',
    boxShadow: '0 4px 16px rgba(93,71,250,0.3)',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '0.88em',
    fontWeight: 500,
  },
  btnSpinner: {
    width: '12px',
    height: '12px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'currentColor',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  searchRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  searchWrap: {
    flex: 1,
    minWidth: '200px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
  },
  searchInput: {
    flex: 1,
    padding: '9px 0',
    background: 'transparent',
    border: 'none',
    color: '#f3f4f6',
    fontSize: '0.9em',
    outline: 'none',
  },
  filterRow: {
    display: 'flex',
    gap: '4px',
  },
  filterBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 12px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '0.8em',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  filterActive: {
    background: 'rgba(93,71,250,0.12)',
    borderColor: 'rgba(93,71,250,0.3)',
    color: '#a78bfa',
  },
  panel: {
    background: 'rgba(255,255,255,0.025)',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '16px',
    animation: 'slideDown 0.2s ease-out',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  panelTitle: {
    margin: 0,
    fontSize: '1em',
    fontWeight: 600,
    color: '#f3f4f6',
  },
  panelClose: {
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  panelHint: {
    color: '#6b7280',
    fontSize: '0.82em',
    margin: '0 0 12px',
    lineHeight: 1.4,
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#f3f4f6',
    fontSize: '0.85em',
    fontFamily: 'monospace',
    resize: 'vertical',
    marginBottom: '12px',
    outline: 'none',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#f3f4f6',
    fontSize: '0.88em',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  itemCount: {
    color: '#6b7280',
    fontSize: '0.82em',
    marginBottom: '8px',
    fontWeight: 500,
  },
  loadingWrap: {
    textAlign: 'center',
    padding: '60px 20px',
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
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  emptyIcon: {
    marginBottom: '16px',
  },
  emptyTitle: {
    color: '#e5e7eb',
    margin: '0 0 8px',
    fontSize: '1.1em',
    fontWeight: 600,
  },
  emptyText: {
    color: '#6b7280',
    margin: '0 0 20px',
    fontSize: '0.88em',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  itemCard: {
    background: 'rgba(255,255,255,0.025)',
    borderRadius: '10px',
    padding: '14px 16px',
    border: '1px solid rgba(255,255,255,0.06)',
    transition: 'all 0.15s',
  },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
    gap: '12px',
  },
  itemName: {
    fontWeight: 600,
    color: '#f3f4f6',
    fontSize: '0.95em',
  },
  itemDesc: {
    color: '#6b7280',
    fontSize: '0.85em',
  },
  deleteBtn: {
    padding: '5px',
    background: 'transparent',
    border: '1px solid rgba(239,68,68,0.15)',
    borderRadius: '6px',
    color: '#6b7280',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemBottom: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    fontSize: '0.82em',
    flexWrap: 'wrap',
  },
  catBadge: {
    padding: '2px 8px',
    borderRadius: '5px',
    fontWeight: 600,
    fontSize: '0.82em',
    textTransform: 'capitalize',
  },
  itemMeta: {
    color: '#6b7280',
    fontVariantNumeric: 'tabular-nums',
  },
  itemMarkup: {
    color: '#22c55e',
    fontWeight: 500,
  },
  jtBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '2px 6px',
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: '4px',
    color: '#22c55e',
    fontWeight: 700,
    fontSize: '0.75em',
  },
};
