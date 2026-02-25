'use client';

import { useState } from 'react';

export default function EstimateTable({ items, onUpdateItem, onDeleteItem, onAddItem, defaultMarkup = 25 }) {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValues({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost,
      markup_pct: item.markup_pct,
      category: item.category,
    });
  };

  const saveEdit = () => {
    if (editingId && onUpdateItem) {
      onUpdateItem(editingId, editValues);
    }
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  // Group items by category
  const grouped = {};
  (items || []).forEach(item => {
    const cat = item.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const totalCost = (items || []).reduce((s, i) => s + (parseFloat(i.total_cost) || 0), 0);
  const totalPrice = (items || []).reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

  if (!items || items.length === 0) {
    return (
      <div style={styles.emptyWrap}>
        <div style={styles.emptyIcon}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#374151' }}>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <p style={styles.emptyText}>No line items yet</p>
        <p style={styles.emptyHint}>Add items manually, from the catalog, or upload a blueprint for AI extraction.</p>
        {onAddItem && (
          <button onClick={onAddItem} style={styles.emptyAddBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add First Item
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '28%' }}>Description</th>
              <th style={{ ...styles.th, width: '8%', textAlign: 'right' }}>Qty</th>
              <th style={{ ...styles.th, width: '8%' }}>Unit</th>
              <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>Unit Cost</th>
              <th style={{ ...styles.th, width: '9%', textAlign: 'right' }}>Markup</th>
              <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>Cost</th>
              <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>Price</th>
              <th style={{ ...styles.th, width: '11%', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([category, catItems]) => (
              <CategoryGroup
                key={category}
                category={category}
                items={catItems}
                editingId={editingId}
                editValues={editValues}
                setEditValues={setEditValues}
                startEdit={startEdit}
                saveEdit={saveEdit}
                cancelEdit={cancelEdit}
                handleKeyDown={handleKeyDown}
                onDeleteItem={onDeleteItem}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="5" style={{ ...styles.footTd, fontWeight: 700, textAlign: 'right' }}>
                Totals
              </td>
              <td style={{ ...styles.footTd, fontWeight: 700, textAlign: 'right' }}>
                ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td style={{ ...styles.footTd, fontWeight: 700, textAlign: 'right', color: '#22c55e' }}>
                ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td style={styles.footTd}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {onAddItem && (
        <button onClick={onAddItem} style={styles.addBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Line Item
        </button>
      )}
    </div>
  );
}

function CategoryGroup({ category, items, editingId, editValues, setEditValues, startEdit, saveEdit, cancelEdit, handleKeyDown, onDeleteItem }) {
  const catTotal = items.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

  return (
    <>
      <tr>
        <td colSpan="8" style={styles.categoryRow}>
          <span style={styles.categoryLabel}>{category}</span>
          <span style={styles.categoryTotal}>${catTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </td>
      </tr>
      {items.map(item => (
        <tr key={item.id} style={styles.row} onDoubleClick={() => startEdit(item)}>
          {editingId === item.id ? (
            <>
              <td style={styles.td}>
                <input style={styles.editInput} value={editValues.description || ''} onChange={e => setEditValues({ ...editValues, description: e.target.value })} onKeyDown={handleKeyDown} autoFocus />
              </td>
              <td style={styles.td}>
                <input style={{ ...styles.editInput, textAlign: 'right' }} type="number" value={editValues.quantity || ''} onChange={e => setEditValues({ ...editValues, quantity: e.target.value })} onKeyDown={handleKeyDown} />
              </td>
              <td style={styles.td}>
                <input style={styles.editInput} value={editValues.unit || ''} onChange={e => setEditValues({ ...editValues, unit: e.target.value })} onKeyDown={handleKeyDown} />
              </td>
              <td style={styles.td}>
                <input style={{ ...styles.editInput, textAlign: 'right' }} type="number" step="0.01" value={editValues.unit_cost || ''} onChange={e => setEditValues({ ...editValues, unit_cost: e.target.value })} onKeyDown={handleKeyDown} />
              </td>
              <td style={styles.td}>
                <input style={{ ...styles.editInput, textAlign: 'right' }} type="number" value={editValues.markup_pct || ''} onChange={e => setEditValues({ ...editValues, markup_pct: e.target.value })} onKeyDown={handleKeyDown} />
              </td>
              <td style={{ ...styles.td, textAlign: 'right', color: '#6b7280' }}>-</td>
              <td style={{ ...styles.td, textAlign: 'right', color: '#6b7280' }}>-</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>
                <div style={styles.editActions}>
                  <button onClick={saveEdit} style={styles.saveBtn} title="Save (Enter)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button onClick={cancelEdit} style={styles.cancelEditBtn} title="Cancel (Esc)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </td>
            </>
          ) : (
            <>
              <td style={styles.td}>
                <span style={styles.descText}>{item.description}</span>
              </td>
              <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.quantity}</td>
              <td style={{ ...styles.td, color: '#9ca3af' }}>{item.unit}</td>
              <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${parseFloat(item.unit_cost || 0).toFixed(2)}</td>
              <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.markup_pct}%</td>
              <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${parseFloat(item.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#22c55e', fontWeight: 600 }}>${parseFloat(item.total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>
                <div style={styles.rowActions}>
                  <button onClick={() => startEdit(item)} style={styles.editBtn} title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {onDeleteItem && (
                    <button onClick={() => onDeleteItem(item.id)} style={styles.deleteBtn} title="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </>
          )}
        </tr>
      ))}
    </>
  );
}

const styles = {
  container: { width: '100%' },
  tableWrap: {
    overflowX: 'auto',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.88em',
  },
  th: {
    padding: '11px 14px',
    textAlign: 'left',
    fontWeight: 600,
    color: '#6b7280',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    fontSize: '0.78em',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: 'rgba(255,255,255,0.02)',
  },
  td: {
    padding: '10px 14px',
    color: '#e5e7eb',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: '0.92em',
  },
  footTd: {
    padding: '12px 14px',
    color: '#e5e7eb',
    borderTop: '2px solid rgba(255,255,255,0.1)',
  },
  categoryRow: {
    padding: '8px 14px',
    background: 'rgba(93,71,250,0.06)',
    borderBottom: '1px solid rgba(93,71,250,0.12)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLabel: {
    fontWeight: 700,
    color: '#a78bfa',
    fontSize: '0.78em',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  categoryTotal: {
    color: '#6b7280',
    fontSize: '0.82em',
    fontVariantNumeric: 'tabular-nums',
  },
  descText: {
    color: '#f3f4f6',
  },
  row: {
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  editInput: {
    width: '100%',
    padding: '6px 8px',
    background: 'rgba(93,71,250,0.08)',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: '6px',
    color: '#f3f4f6',
    fontSize: '0.92em',
    fontFamily: 'inherit',
    outline: 'none',
  },
  rowActions: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'center',
  },
  editActions: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'center',
  },
  editBtn: {
    padding: '5px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: '#6b7280',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
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
    transition: 'all 0.15s',
  },
  saveBtn: {
    padding: '5px',
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: '6px',
    color: '#22c55e',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelEditBtn: {
    padding: '5px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: '#6b7280',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '12px',
    padding: '9px 16px',
    background: 'transparent',
    border: '1px dashed rgba(93,71,250,0.3)',
    borderRadius: '8px',
    color: '#a78bfa',
    cursor: 'pointer',
    fontSize: '0.85em',
    fontWeight: 500,
    width: '100%',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  emptyWrap: {
    textAlign: 'center',
    padding: '48px 20px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  emptyIcon: {
    marginBottom: '16px',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: '0.95em',
    fontWeight: 500,
    margin: '0 0 4px',
  },
  emptyHint: {
    color: '#6b7280',
    fontSize: '0.82em',
    margin: '0 0 20px',
    maxWidth: '350px',
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: 1.5,
  },
  emptyAddBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 20px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.88em',
    fontWeight: 600,
    boxShadow: '0 4px 12px rgba(93,71,250,0.3)',
  },
};
