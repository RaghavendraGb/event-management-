import { create } from 'zustand';

export const useStore = create((set) => ({
  // ── Auth ─────────────────────────────────────────────────────
  user: null,
  setUser: (user) => set({ user }),
  isAuthLoading: true,
  setAuthLoading: (loading) => set({ isAuthLoading: loading }),

  // ── Generic ──────────────────────────────────────────────────
  currentEvent: null,
  setCurrentEvent: (event) => set({ currentEvent: event }),
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  // ── Live Event Runtime (Single Source of Truth) ───────────────
  // Populated by LiveEvent on boot; cleared on unmount.
  // All components (Lobby, LiveEvent, LiveLeaderboard) can read from here
  // to avoid distributed state. Shape:
  //   { eventId, status, startTime, endTime, currentQuestionIndex, questionStartTime }
  liveEventRuntime: null,
  setLiveEventRuntime: (runtime) => set({ liveEventRuntime: runtime }),
  patchLiveEventRuntime: (patch) =>
    set((state) => ({
      liveEventRuntime: state.liveEventRuntime
        ? { ...state.liveEventRuntime, ...patch }
        : patch,
    })),
  clearLiveEventRuntime: () => set({ liveEventRuntime: null }),
}));
