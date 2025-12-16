import React, { useEffect, useState } from 'react';
import { billsApi } from '../api/client';

function Bills() {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState('');
  const [reference, setReference] = useState('');
  const [bill, setBill] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const load = async () => {
      const res = await billsApi.getCategories();
      setCategories(res.data.categories || []);
    };
    load();
  }, []);

  const fetchBill = async (e) => {
    e.preventDefault();
    setMessage(null);
    const res = await billsApi.fetchBill({ category: selected, reference });
    setBill(res.data.bill);
  };

  const payBill = async () => {
    if (!bill) return;
    const res = await billsApi.payBill({ bill_id: bill.id });
    setMessage(res.data.message || 'Bill paid');
  };

  return (
    <div>
      <h2>Bills</h2>
      <form onSubmit={fetchBill} style={{ display: 'grid', gap: '0.75rem', maxWidth: '420px' }} aria-label="bill-fetch-form">
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Category</span>
          <select
            aria-label="bill-category-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            required
            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Reference</span>
          <input
            aria-label="bill-reference-input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <button type="submit" aria-label="bill-fetch-submit" style={{
          padding: '0.75rem',
          background: '#0f172a',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
        }}>
          Fetch bill
        </button>
      </form>

      {bill && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <div style={{ fontWeight: 600 }}>{bill.category}</div>
          <div>Amount: ₹ {(bill.amount_cents / 100).toFixed(2)}</div>
          <div>Reference: {bill.reference}</div>
          <button
            aria-label="bill-pay-button"
            onClick={payBill}
            style={{
              marginTop: '0.75rem',
              padding: '0.65rem 0.9rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            Pay now
          </button>
        </div>
      )}

      {message && <div style={{ marginTop: '0.75rem', color: '#0f172a' }}>{message}</div>}
    </div>
  );
}

export default Bills;
