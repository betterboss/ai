'use client';

import { useState, useEffect } from 'react';

const CATEGORY_COLORS = {
  material: '#8ab4f8',
  labor: '#34A853',
  equipment: '#FBBC05',
  subcontractor: '#EA4335',
};

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
          <div style={styles.headerLeft}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8ab4f8' }}>
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 style={styles.title}>Add from Catalog</h3>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSearch} style={styles.searchRow}>
          <div style={styles.searchWrap}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="Search catalog..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            style={styles.select}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">All</option>
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
            filtered.map(item => {
              const catColor = CATEGORY_COLORS[item.category] || '#8ab4f8';
              return (
                <div
                  key={item.id}
                  style={styles.item}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <div style={styles.itemTop}>
                    <div style={styles.itemName}>{item.name}</div>
                    <span style={{ ...styles.catBadge, background: catColor + '15', color: catColor, border: `1px solid ${catColor}30` }}>
                      {item.category}
                    </span>
                  </div>
                  <div style={styles.itemMeta}>
                    <span style={styles.itemPrice}>${parseFloat(item.unit_cost || 0).toFixed(2)} / {item.unit}</span>
                    {item.markup_pct > 0 && <span style={styles.itemMarkup}>+{item.markup_pct}%</span>}
                  </div>
                  {item.description && (
                    <div style={styles.itemDesc}>{item.description}</div>
                  )}
                </div>
              );
            })
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
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxWidth: '560px',
    maxHeight: '80vh',
    background: '#111318',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: { color: '#f3f4f6', margin: 0, fontSize: '1.05em', fontWeight: 600 },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  searchRow: {
    display: 'flex',
    gap: '8px',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  searchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 12px',
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
    fontSize: '0.88em',
    outline: 'none',
  },
  select: {
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.85em',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
  },
  empty: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '40px',
    fontSize: '0.9em',
  },
  item: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.04)',
    marginBottom: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'rgba(255,255,255,0.02)',
  },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  itemName: {
    color: '#f3f4f6',
    fontWeight: 600,
    fontSize: '0.92em',
  },
  catBadge: {
    padding: '2px 8px',
    borderRadius: '5px',
    fontSize: '0.7em',
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  itemMeta: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  itemPrice: {
    color: '#9ca3af',
    fontSize: '0.82em',
    fontVariantNumeric: 'tabular-nums',
  },
  itemMarkup: {
    color: '#6b7280',
    fontSize: '0.78em',
  },
  itemDesc: {
    color: '#6b7280',
    fontSize: '0.78em',
    marginTop: '4px',
    lineHeight: 1.4,
  },
};
