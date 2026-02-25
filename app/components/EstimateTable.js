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

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '25%' }}>Description</th>
            <th style={{ ...styles.th, width: '10%', textAlign: 'right' }}>Qty</th>
            <th style={{ ...styles.th, width: '10%' }}>Unit</th>
            <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>Unit Cost</th>
            <th style={{ ...styles.th, width: '10%', textAlign: 'right' }}>Markup %</th>
            <th style={{ ...styles.th, width: '13%', textAlign: 'right' }}>Cost</th>
            <th style={{ ...styles.th, width: '13%', textAlign: 'right' }}>Price</th>
            <th style={{ ...styles.th, width: '7%' }}></th>
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
            <td colSpan="5" style={{ ...styles.td, fontWeight: 700, textAlign: 'right', borderTop: '2px solid rgba(255,255,255,0.15)' }}>
              Totals
            </td>
            <td style={{ ...styles.td, fontWeight: 700, textAlign: 'right', borderTop: '2px solid rgba(255,255,255,0.15)' }}>
              ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
            <td style={{ ...styles.td, fontWeight: 700, textAlign: 'right', color: '#00c853', borderTop: '2px solid rgba(255,255,255,0.15)' }}>
              ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
            <td style={{ ...styles.td, borderTop: '2px solid rgba(255,255,255,0.15)' }}></td>
          </tr>
        </tfoot>
      </table>

      {onAddItem && (
        <button onClick={onAddItem} style={styles.addBtn}>
          + Add Line Item
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
                <input style={styles.input} value={editValues.description || ''} onChange={e => setEditValues({ ...editValues, description: e.target.value })} onKeyDown={handleKeyDown} autoFocus />
              </td>
              <td style={styles.td}>
                <input style={{ ...styles.input, textAlign: 'right' }} type="number" value={editValues.quantity || ''} onChange={e => setEditValues({ ...editValues, quantity: e.target.value })} onKeyDown={handleKeyDown} />
              </td>
              <td style={styles.td}>
                <input style={styles.input} value={editValues.unit || ''} onChange={e => setEditValues({ ...editValues, unit: e.target.value })} onKeyDown={handleKeyDown} />
              </td>
              <td style={styles.td}>
                <input style={{ ...styles.input, textAlign: 'right' }} type="number" step="0.01" value={editValues.unit_cost || ''} onChange={e => setEditValues({ ...editValues, unit_cost: e.target.value })} onKeyDown={handleKeyDown} />
              </td>
              <td style={styles.td}>
                <input style={{ ...styles.input, textAlign: 'right' }} type="number" value={editValues.markup_pct || ''} onChange={e => setEditValues({ ...editValues, markup_pct: e.target.value })} onKeyDown={handleKeyDown} />
              </td>
              <td style={{ ...styles.td, textAlign: 'right' }}>-</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>-</td>
              <td style={styles.td}>
                <button onClick={saveEdit} style={styles.saveBtn} title="Save">Save</button>
                <button onClick={cancelEdit} style={styles.cancelBtn} title="Cancel">X</button>
              </td>
            </>
          ) : (
            <>
              <td style={styles.td}>{item.description}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>{item.quantity}</td>
              <td style={styles.td}>{item.unit}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>${parseFloat(item.unit_cost || 0).toFixed(2)}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>{item.markup_pct}%</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>${parseFloat(item.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td style={{ ...styles.td, textAlign: 'right', color: '#00c853' }}>${parseFloat(item.total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td style={styles.td}>
                <button onClick={() => startEdit(item)} style={styles.editBtn} title="Edit">E</button>
                {onDeleteItem && <button onClick={() => onDeleteItem(item.id)} style={styles.deleteBtn} title="Delete">X</button>}
              </td>
            </>
          )}
        </tr>
      ))}
    </>
  );
}

const styles = {
  container: { width: '100%', overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9em',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 600,
    color: '#8899a6',
    borderBottom: '2px solid rgba(255,255,255,0.1)',
    fontSize: '0.85em',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '8px 12px',
    color: '#f0f4f8',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  categoryRow: {
    padding: '10px 12px',
    background: 'rgba(93,71,250,0.08)',
    borderBottom: '1px solid rgba(93,71,250,0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLabel: {
    fontWeight: 700,
    color: '#7a64ff',
    fontSize: '0.85em',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  categoryTotal: {
    color: '#8899a6',
    fontSize: '0.85em',
  },
  row: { cursor: 'pointer' },
  input: {
    width: '100%',
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(93,71,250,0.4)',
    borderRadius: '4px',
    color: '#f0f4f8',
    fontSize: '0.9em',
  },
  addBtn: {
    marginTop: '12px',
    padding: '8px 16px',
    background: 'rgba(93,71,250,0.15)',
    border: '1px dashed rgba(93,71,250,0.4)',
    borderRadius: '8px',
    color: '#7a64ff',
    cursor: 'pointer',
    fontSize: '0.9em',
    width: '100%',
  },
  editBtn: {
    padding: '2px 8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    color: '#8899a6',
    cursor: 'pointer',
    fontSize: '0.75em',
    marginRight: '4px',
  },
  deleteBtn: {
    padding: '2px 8px',
    background: 'transparent',
    border: '1px solid rgba(255,82,82,0.3)',
    borderRadius: '4px',
    color: '#ff5252',
    cursor: 'pointer',
    fontSize: '0.75em',
  },
  saveBtn: {
    padding: '2px 8px',
    background: 'rgba(0,200,83,0.15)',
    border: '1px solid rgba(0,200,83,0.4)',
    borderRadius: '4px',
    color: '#00c853',
    cursor: 'pointer',
    fontSize: '0.75em',
    marginRight: '4px',
  },
  cancelBtn: {
    padding: '2px 8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    color: '#8899a6',
    cursor: 'pointer',
    fontSize: '0.75em',
  },
};
