import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useStore } from '../store';

/**
 * useNetworkStatus — Feature 5
 * Detects: online | slow | offline | recovery
 * Writes result to Zustand store (networkStatus).
 * - Uses navigator.onLine + browser events for instant offline detection
 * - Periodic Supabase ping to detect "slow" connections (timeout 4s)
 * - Recovery state auto-clears after 3 seconds (reverts to 'online')
 */
export function useNetworkStatus() {
  const setNetworkStatus = useStore((state) => state.setNetworkStatus);
  const recoveryTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const lastStatusRef = useRef('online');

  const applyStatus = (status) => {
    if (lastStatusRef.current === status) return; // no-op if unchanged
    lastStatusRef.current = status;
    setNetworkStatus(status);

    if (status === 'recovery') {
      // Auto-clear recovery back to 'online' after 3 seconds
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = setTimeout(() => {
        lastStatusRef.current = 'online';
        setNetworkStatus('online');
        recoveryTimerRef.current = null;
      }, 3000);
    }
  };

  const ping = async () => {
    if (!navigator.onLine) {
      applyStatus('offline');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const start = Date.now();
      await supabase
        .from('events')
        .select('id')
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);
      const elapsed = Date.now() - start;

      const wasOfflineOrSlow =
        lastStatusRef.current === 'offline' || lastStatusRef.current === 'slow';

      if (elapsed > 3000) {
        applyStatus('slow');
      } else if (wasOfflineOrSlow) {
        applyStatus('recovery');
      } else {
        applyStatus('online');
      }
    } catch {
      clearTimeout(timeoutId);
      // AbortError from timeout = slow; otherwise offline
      applyStatus(navigator.onLine ? 'slow' : 'offline');
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      // Browser says online — do a real ping to confirm quality
      ping();
    };
    const handleOffline = () => {
      applyStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Ping every 15 seconds (low overhead — only 1 row select)
    pingIntervalRef.current = setInterval(ping, 15_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
