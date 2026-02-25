'use client';

import { useState, useEffect } from 'react';

export default function CatalogPicker({ onSelect, onClose }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, [category]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (search) params.set('search', search);

      const res = await fetch('/api/catalog?' + params.toString());
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadItems();
  };

  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Add from Catalog</h3>
          <button onClick={onClose} style={styles.closeBtn}>X</button>
        </div>

        <form onSubmit={handleSearch} style={styles.searchRow}>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search catalog..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            style={styles.select}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="material">Materials</option>
            <option value="labor">Labor</option>
            <option value="equipment">Equipment</option>
            <option value="subcontractor">Subcontractor</option>
          </select>
        </form>

        <div style={styles.list}>
          {loading ? (
            <div style={styles.empty}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={styles.empty}>No items found</div>
          ) : (
            filtered.map(item => (
              <div
                key={item.id}
                style={styles.item}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <div style={styles.itemName}>{item.name}</div>
                <div style={styles.itemMeta}>
                  <span style={styles.badge}>{item.category}</span>
                  <span>${parseFloat(item.unit_cost || 0).toFixed(2)} / {item.unit}</span>
                  {item.markup_pct > 0 && <span>+{item.markup_pct}% markup</span>}
                </div>
                {item.description && (
                  <div style={styles.itemDesc}>{item.description}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    background: '#1a2332',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: { color: '#f0f4f8', margin: 0, fontSize: '1.1em' },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#8899a6',
    cursor: 'pointer',
    fontSize: '1.2em',
  },
  searchRow: {
    display: 'flex',
    gap: '8px',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#f0f4f8',
    fontSize: '0.9em',
  },
  select: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#f0f4f8',
    fontSize: '0.9em',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 20px',
  },
  empty: {
    textAlign: 'center',
    color: '#8899a6',
    padding: '40px',
  },
  item: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  itemName: {
    color: '#f0f4f8',
    fontWeight: 600,
    fontSize: '0.95em',
    marginBottom: '4px',
  },
  itemMeta: {
    display: 'flex',
    gap: '12px',
    color: '#8899a6',
    fontSize: '0.8em',
  },
  badge: {
    padding: '1px 6px',
    background: 'rgba(93,71,250,0.15)',
    borderRadius: '4px',
    color: '#7a64ff',
    fontSize: '0.85em',
  },
  itemDesc: {
    color: '#8899a6',
    fontSize: '0.8em',
    marginTop: '4px',
  },
};
