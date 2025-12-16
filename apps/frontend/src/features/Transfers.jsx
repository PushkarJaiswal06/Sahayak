import React, { useEffect, useState } from 'react';
import { bankingApi } from '../api/client';
import useBankingStore from '../stores/bankingStore';

function Transfers() {
  const { accounts, beneficiaries, setAccounts, setBeneficiaries } = useBankingStore();
  const [form, setForm] = useState({ account_id: '', beneficiary_id: '', amount: '', note: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [acctRes, benRes] = await Promise.all([
        bankingApi.getAccounts(),
        bankingApi.getBeneficiaries(),
      ]);
      setAccounts(acctRes.data.accounts || []);
      setBeneficiaries(benRes.data.beneficiaries || []);
    };
    load();
  }, [setAccounts, setBeneficiaries]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await bankingApi.transfer({
        account_id: form.account_id,
        amount_cents: Math.round(parseFloat(form.amount || '0') * 100),
        beneficiary_id: form.beneficiary_id,
        note: form.note,
      });
      setMessage('Transfer submitted');
      setForm((prev) => ({ ...prev, amount: '', note: '' }));
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Transfers</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: '0.8rem', maxWidth: '480px' }} aria-label="transfer-form">
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>From account</span>
          <select
            aria-label="from-account-select"
            name="account_id"
            value={form.account_id}
            onChange={handleChange}
            required
            style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.type} • {a.account_number}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>To beneficiary</span>
          <select
            aria-label="beneficiary-select"
            name="beneficiary_id"
            value={form.beneficiary_id}
            onChange={handleChange}
            required
            style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          >
            <option value="">Select beneficiary</option>
            {beneficiaries.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nickname} • {b.account_number}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Amount (₹)</span>
          <input
            aria-label="amount-input"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={handleChange}
            required
            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Note</span>
          <input
            aria-label="note-input"
            name="note"
            value={form.note}
            onChange={handleChange}
            placeholder="Optional"
            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <button
          aria-label="transfer-submit"
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            background: '#0f172a',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Submitting…' : 'Send money'}
        </button>
        {message && <div style={{ color: '#0f172a' }}>{message}</div>}
      </form>
    </div>
  );
}

export default Transfers;
