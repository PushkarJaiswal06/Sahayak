import React, { useEffect } from 'react';
import { bankingApi } from '../api/client';
import useBankingStore from '../stores/bankingStore';

function Dashboard() {
  const { accounts, transactions, setAccounts, setTransactions, setLoading, loading } = useBankingStore();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [acctRes, txRes] = await Promise.all([
          bankingApi.getAccounts(),
          bankingApi.getTransactions(10),
        ]);
        setAccounts(acctRes.data.accounts || []);
        setTransactions(txRes.data.records || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setAccounts, setTransactions, setLoading]);

  return (
    <div>
      <h2>Overview</h2>
      {loading && <div>Loading…</div>}
      <section style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {accounts.map((acct) => (
          <div key={acct.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <div style={{ fontWeight: 600 }}>{acct.type}</div>
            <div style={{ fontSize: '1.4rem', marginTop: '0.3rem' }}>
              ₹ {(acct.balance_cents / 100).toFixed(2)}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{acct.account_number}</div>
          </div>
        ))}
      </section>

      <h3 style={{ marginTop: '1.5rem' }}>Recent activity</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="transactions-table">
        <thead>
          <tr>
            <th align="left">Time</th>
            <th align="left">Type</th>
            <th align="right">Amount</th>
            <th align="left">Counterparty</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} style={{ borderTop: '1px solid #e2e8f0' }}>
              <td>{new Date(tx.created_at).toLocaleString()}</td>
              <td>{tx.type}</td>
              <td align="right">{(tx.amount_cents / 100).toFixed(2)}</td>
              <td>{tx.counterparty || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;
