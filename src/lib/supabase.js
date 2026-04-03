import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jfqynyxhzusyiwavuijg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcXlueXhoenVzeWl3YXZ1aWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjY4NjEsImV4cCI6MjA5MDc0Mjg2MX0._5clBR5d0gCd-LXiB4mEcXyV486nODPXI0hVE-OwOwA';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Fix #1: Server Clock Offset ──────────────────────────────────
// We derive an offset once at start-up so that every `now()` call
// compensates for client clock skew.  The offset is cached for the
// session so subsequent pages don't pay another network round-trip.
let _clockOffset = 0;           // ms difference: serverTime - clientTime
let _clockOffsetReady = false;

/**
 * Returns the estimated server-side "now" in milliseconds.
 * Falls back to Date.now() if the offset has not been initialized yet.
 */
export function serverNow() {
  return Date.now() + _clockOffset;
}

/**
 * Call once during app boot (e.g. in App.jsx).
 * Queries `events` with limit=0 to get the Supabase response headers
 * and reads the X-Supabase-Date header as an approximation of server time.
 *
 * Fall-back: if the header is absent, the offset stays 0 (no correction).
 */
export async function initClockOffset() {
  if (_clockOffsetReady) return _clockOffset;
  try {
    const before = Date.now();
    // HEAD request trick — any table works, we just need the response timestamp
    const res = await fetch(
      `${supabaseUrl}/rest/v1/events?select=id&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const after = Date.now();
    const dateHeader = res.headers.get('date'); // RFC-2616 UTC date
    if (dateHeader) {
      const serverMs = new Date(dateHeader).getTime();
      // Use mid-point of round-trip as client timestamp
      const clientMid = Math.round((before + after) / 2);
      _clockOffset = serverMs - clientMid;
    }
  } catch {
    _clockOffset = 0; // safe default — no correction
  }
  _clockOffsetReady = true;
  console.log(`[Clock] offset=${_clockOffset}ms`);
  return _clockOffset;
}
