'use client';

import { useState, useEffect, useRef } from 'react';
import Nav from '../components/Nav';

const CATEGORIES = ['material', 'labor', 'equipment', 'subcontractor'];
const CATEGORY_COLORS = {
  material: '#7a64ff',
  labor: '#00c853',
  equipment: '#ffc107',
  subcontractor: '#ff5252',
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
      // Parse CSV: header row + data rows
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
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Cost Catalog</h1>
            <p style={styles.subtitle}>Manage your materials, labor rates, and cost items</p>
          </div>
          <div style={styles.headerActions}>
            <button onClick={syncFromJobTread} disabled={syncingJT} style={styles.secondaryBtn}>
              {syncingJT ? 'Syncing...' : 'Sync from JobTread'}
            </button>
            <button onClick={() => setShowImport(!showImport)} style={styles.secondaryBtn}>
              Import CSV
            </button>
            <button onClick={() => setShowAdd(!showAdd)} style={styles.primaryBtn}>
              + Add Item
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div style={styles.searchRow}>
          <input
            style={styles.searchInput}
            placeholder="Search catalog..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={styles.filterRow}>
            <button onClick={() => setFilter('')} style={{ ...styles.filterBtn, ...(!filter ? styles.filterActive : {}) }}>All</button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  ...styles.filterBtn,
                  ...(filter === cat ? { ...styles.filterActive, borderColor: CATEGORY_COLORS[cat], color: CATEGORY_COLORS[cat] } : {}),
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Import CSV Panel */}
        {showImport && (
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Import from CSV</h3>
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
            <h3 style={styles.panelTitle}>Add Catalog Item</h3>
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
            <button type="submit" style={{ ...styles.primaryBtn, marginTop: '12px' }}>Add Item</button>
          </form>
        )}

        {/* Items List */}
        <div style={styles.itemCount}>{filtered.length} items</div>

        {loading ? (
          <div style={styles.empty}>Loading catalog...</div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No catalog items yet. Add items or import from CSV.</p>
          </div>
        ) : (
          <div style={styles.list}>
            {filtered.map(item => (
              <div key={item.id} style={styles.itemCard}>
                <div style={styles.itemTop}>
                  <div>
                    <span style={styles.itemName}>{item.name}</span>
                    {item.description && <span style={styles.itemDesc}> - {item.description}</span>}
                  </div>
                  <button onClick={() => deleteItem(item.id)} style={styles.deleteBtn}>X</button>
                </div>
                <div style={styles.itemBottom}>
                  <span style={{ ...styles.catBadge, background: `${CATEGORY_COLORS[item.category] || '#7a64ff'}22`, color: CATEGORY_COLORS[item.category] || '#7a64ff' }}>
                    {item.category}
                  </span>
                  <span style={styles.itemMeta}>${parseFloat(item.unit_cost || 0).toFixed(2)} / {item.unit}</span>
                  {item.markup_pct > 0 && <span style={styles.itemMeta}>+{item.markup_pct}% markup</span>}
                  {item.supplier && <span style={styles.itemMeta}>{item.supplier}</span>}
                  {item.jobtread_cost_code_id && <span style={styles.jtBadge}>JT</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f1419',
    color: '#f0f4f8',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontSize: '1.8em',
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: '#8899a6',
    margin: '4px 0 0',
    fontSize: '0.95em',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  primaryBtn: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9em',
  },
  secondaryBtn: {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: '#f0f4f8',
    cursor: 'pointer',
    fontSize: '0.9em',
  },
  searchRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#f0f4f8',
    fontSize: '0.9em',
  },
  filterRow: {
    display: 'flex',
    gap: '4px',
  },
  filterBtn: {
    padding: '4px 12px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    color: '#8899a6',
    cursor: 'pointer',
    fontSize: '0.8em',
    textTransform: 'capitalize',
  },
  filterActive: {
    background: 'rgba(93,71,250,0.15)',
    borderColor: 'rgba(93,71,250,0.4)',
    color: '#7a64ff',
  },
  panel: {
    background: '#1a2332',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '16px',
  },
  panelTitle: {
    margin: '0 0 8px',
    fontSize: '1em',
    fontWeight: 600,
  },
  panelHint: {
    color: '#8899a6',
    fontSize: '0.8em',
    margin: '0 0 12px',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#f0f4f8',
    fontSize: '0.85em',
    fontFamily: 'monospace',
    resize: 'vertical',
    marginBottom: '12px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#f0f4f8',
    fontSize: '0.85em',
  },
  itemCount: {
    color: '#8899a6',
    fontSize: '0.85em',
    marginBottom: '8px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  itemCard: {
    background: '#1a2332',
    borderRadius: '10px',
    padding: '12px 16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '6px',
  },
  itemName: {
    fontWeight: 600,
    color: '#f0f4f8',
    fontSize: '0.95em',
  },
  itemDesc: {
    color: '#8899a6',
    fontSize: '0.85em',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ff5252',
    cursor: 'pointer',
    fontSize: '0.8em',
    padding: '2px 6px',
  },
  itemBottom: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    fontSize: '0.8em',
  },
  catBadge: {
    padding: '1px 8px',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '0.85em',
    textTransform: 'capitalize',
  },
  jtBadge: {
    padding: '1px 6px',
    background: 'rgba(0,200,83,0.15)',
    borderRadius: '4px',
    color: '#00c853',
    fontWeight: 700,
    fontSize: '0.7em',
  },
  itemMeta: {
    color: '#8899a6',
  },
  empty: {
    textAlign: 'center',
    color: '#8899a6',
    padding: '40px',
  },
  emptyState: {
    textAlign: 'center',
    color: '#8899a6',
    padding: '60px',
  },
};
