import { create } from 'zustand';

const useBankingStore = create((set) => ({
  accounts: [],
  transactions: [],
  beneficiaries: [],
  loading: false,
  error: null,

  setAccounts: (accounts) => set({ accounts }),
  setTransactions: (transactions) => set({ transactions }),
  setBeneficiaries: (beneficiaries) => set({ beneficiaries }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

export default useBankingStore;
