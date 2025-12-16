import React, { useEffect, useState } from 'react';
import { authApi, bankingApi } from '../api/client';
import useAuthStore from '../stores/authStore';
import useBankingStore from '../stores/bankingStore';

function Profile() {
  const { user, setUser } = useAuthStore();
  const { beneficiaries, setBeneficiaries } = useBankingStore();
  const [form, setForm] = useState({ nickname: '', account_number: '', bank_name: '' });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        const me = await authApi.me();
        setUser(me.data);
      }
      const benRes = await bankingApi.getBeneficiaries();
      setBeneficiaries(benRes.data.beneficiaries || []);
    };
    load();
  }, [user, setUser, setBeneficiaries]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await bankingApi.addBeneficiary(form);
      setBeneficiaries(res.data.beneficiaries || []);
      setForm({ nickname: '', account_number: '', bank_name: '' });
      setMessage('Beneficiary added');
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Failed to add beneficiary');
    }
  };

  return (
    <div>
      <h2>Profile</h2>
      {user && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600 }}>{user.full_name || user.email}</div>
          <div style={{ color: '#64748b' }}>{user.email}</div>
        </div>
      )}

      <h3>Beneficiaries</h3>
      <ul aria-label="beneficiaries-list">
        {beneficiaries.map((b) => (
          <li key={b.id}>
            {b.nickname} • {b.account_number} • {b.bank_name}
          </li>
        ))}
      </ul>

      <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem', maxWidth: '460px', marginTop: '1rem' }} aria-label="beneficiary-form">
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Nickname</span>
          <input
            aria-label="beneficiary-nickname-input"
            name="nickname"
            value={form.nickname}
            onChange={handleChange}
            required
            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Account number</span>
          <input
            aria-label="beneficiary-account-input"
            name="account_number"
            value={form.account_number}
            onChange={handleChange}
            required
            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Bank name</span>
          <input
            aria-label="beneficiary-bank-input"
            name="bank_name"
            value={form.bank_name}
            onChange={handleChange}
            required
            style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <button
          aria-label="beneficiary-submit"
          type="submit"
          style={{
            padding: '0.75rem',
            background: '#0f172a',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          Save beneficiary
        </button>
        {message && <div style={{ color: '#0f172a' }}>{message}</div>}
      </form>
    </div>
  );
}

export default Profile;
