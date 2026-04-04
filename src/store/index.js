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
  // Shape: { eventId, eventTitle, status, startTime, endTime,
  //          currentQuestionIndex, totalQuestions, questionStartTime, timeLeftStr }
  liveEventRuntime: null,
  setLiveEventRuntime: (runtime) => set({ liveEventRuntime: runtime }),
  patchLiveEventRuntime: (patch) =>
    set((state) => ({
      liveEventRuntime: state.liveEventRuntime
        ? { ...state.liveEventRuntime, ...patch }
        : patch,
    })),
  clearLiveEventRuntime: () => set({ liveEventRuntime: null }),

  // ── Preloaded Questions (Feature 2) ───────────────────────────
  // Set by Lobby before event starts; consumed & cleared by LiveEvent on boot.
  // Shape: { eventId: string, questions: array }
  preloadedQuestions: null,
  setPreloadedQuestions: (data) => set({ preloadedQuestions: data }),
  clearPreloadedQuestions: () => set({ preloadedQuestions: null }),

  // ── Network Status (Feature 5) ────────────────────────────────
  // 'online' | 'slow' | 'offline' | 'recovery'
  networkStatus: 'online',
  setNetworkStatus: (status) => set({ networkStatus: status }),
}));
