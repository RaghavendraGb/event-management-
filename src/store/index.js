import { create } from 'zustand';

export const useStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  isAuthLoading: true, // Used when initially checking session
  setAuthLoading: (loading) => set({ isAuthLoading: loading }),
  
  currentEvent: null,
  setCurrentEvent: (event) => set({ currentEvent: event }),
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
}));
