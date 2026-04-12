# Zentrix - Platform Architecture

This document maps out the entire Zentrix competition platform, detailing the engineering systems, database flow, and user experience flows we've constructed.

## Overview
Zentrix is a synchronized, offline-resilient, realtime-driven web application designed to host massive multiplayer college exams, treasure hunts, and rapid-fire quizzes without succumbing to bad Wi-Fi or cheating students.

***

## Technology Stack

*   **Frontend**: React.js 18 + Vite (Performance optimized bundler)
*   **Styling**: Tailwind CSS v4 (Using raw utility classes and complex Glassmorphism UI)
*   **State Management**: Zustand (For global user/authentication syncing across the component tree)
*   **Backend & DB**: Supabase (PostgreSQL, Realtime Subscriptions, Row Level Security)
*   **Cloud Operations**: Supabase Edge Functions (Deno Runtime) + Resend (Email dispatcher)
*   **Core Libraries**:
    *   `jsPDF`: Client-side digital certificate synthesis.
    *   `jsQR`: WebRTC hardware webcam injection for ticket scanning.
    *   `PapaParse`: CSV bulk-translation engine.
    *   `framer-motion`: High-framerate physics animations.
    *   `vite-plugin-pwa`: Progressive Web App (PWA) Workbox service worker wrapper.

***

## 1. Application Core & Routing (`/src/App.jsx`)
The platform is completely protected via dynamic routing (`ProtectedRoute`). Unauthenticated users are strictly barred from `/live`, `/dashboard`, or `/admin`.
*   **PWA Offline Layer**: Navigational wrappers inherently track `window.navigator.onLine`. If the device physically drops its internet connection, a massive locking UI stops the user from breaking their LocalStorage sequence.

## 2. Main Participant Flow

### A. The Waiting Lobby (`/lobby/:id`)
*   **The Ticket**: Upon registering, a unique QR Code SVG is generated mapping to the user's isolated `participation.id`.
*   **Realtime Presence**: Natively invokes Supabase's `Channel` structure to show a live, pulsating count of active competitors waiting alongside the user.
*   **Auto-Teleport**: The lobby strictly listens for Postgres database row changes. When an Admin switches the event's status from `upcoming` to `live`, the active listener inherently teleports the entire lobby to the `/live` competition engine simultaneously.

### B. The Competition Engine (`/live/:id`)
The engine is split into multi-mode components (`NormalQuizMode`, `RapidFireMode`) handling varying logic. 
*   **Anti-Cheat System**: 
    1.  The browser is commanded natively into Fullscreen lock.
    2.  Custom vanilla JS events strictly disable Right-Clicking (`contextmenu`), Copying, and Pasting.
    3.  `visibilitychange` hooks monitor if a student switches tabs or alt-tabs to a secondary window. Doing so instantly issues an orange Strike.
    4.  At 3 Strikes, the engine halts, securely dumps their active answers to the Postgres database, and kicks them off the server.
*   **Offline-First Strategy**: The moment an answer is pressed, it bypasses the network layer completely and saves into the local browser cache (`localStorage`). A silent array queue then asynchronously handshakes Supabase to back up the data. If the network drops, the cache guarantees data survives arbitrary page refreshes!

### C. The Winner Ceremony (`/results/:id`)
When the Admin switches the Event to `ended`, the game shuts down and transitions users here.
*   **A 6-Phase State Machine**: It manipulates user tension. The screen goes black, "Calculating..." appears.
*   **The Native Drumroll**: We leverage the browser's raw `AudioContext` (Web Audio API) to mathematically synthesize an electronic snare drum using low-pass noise generation rather than forcing users to download large MP3 files.
*   **Physics Rendering**: `framer-motion` animates the staggering deployment of the 3rd, 2nd, and 1st place cards onto the screen, finally capped with a visual explosion from `canvas-confetti`.

### D. Cryptographic Certificates (`/certificate/:id`)
*   **Client Generation**: `jsPDF` mathematically maps the specific Winner or Participation template inside the browser canvas, dropping the user's exact dynamically generated `score` and `rank` directly onto the PDF file.
*   **Supabase Blob Push**: While rendering to the local PC, the script concurrently generates a binary Blob and pushes it into the `certificates` Cloud bucket.
*   **Verification Portal (`/verify`)**: Anyone globally can hit `/verify/<HASH_KEY>`. The system validates the Hash against the Postgres registry completely securing the platform against forged Photoshop documents.

***

## 3. The Administrative Architecture (`/admin`)

The platform supports a robust `is_admin()` SQL definition letting Event Organizers handle everything through GUI controls.

*   **Global Command Center**: Parallel SQL queries natively aggregate total Active Load, certificates, and event telemetry.
*   **Status Controllers**: Push-button modifiers let Admins trip the "Live" and "End" statuses, directly puppeteering thousands of users scattered across the internet via Postgres callbacks.
*   **PapaParse Importer**: An ingest engine safely mapping `.csv` files uploaded by users straight into the rigid JSONB options arrays natively demanded by Postgres.
*   **WebRTC Hardware Scanner**: The `AdminParticipants` tab executes a local HTTP handshake allowing the admin to pipe their local physical laptop Webcam into an HTML5 `<video>` feed. At 60FPS, `jsQR` rips the pixel matrix and securely matches scanned Student QR code combinations directly into the internal Database verification loop.

***

## 4. Edge Notifications Engine
Built separate from React, an autonomous Deno TypeScript function lives on the Edge Server (`supabase/functions/send-email`).
*   It securely stores secret configuration codes (e.g. `RESEND_API_KEY`).
*   By issuing `HTTP POST` requests locally on the frontend, the Edge computes dynamic HTML markup (dynamically building custom confirmation blocks vs Winner ranking emails) and delegates it reliably over TCP to the Resend cloud platform without ever exposing mail keys to the end-users.

***

## 5. Centralized Event Controller (Backend Brain)

The platform now includes a centralized control plane for event lifecycle orchestration.

*   **Edge Function**: `supabase/functions/event-controller/index.ts`
    *   Authenticates the caller using the request JWT.
    *   Accepts control actions: `start`, `pause`, `resume`, `end`, `force_end`.
    *   Calls one authoritative RPC (`admin_control_event`) and returns synchronized event state.

*   **RPC Control Contract**: `public.admin_control_event(...)`
    *   Lives in `database/event_mode_compat_patch.sql`.
    *   Enforces **admin-only** control (`is_admin()` guard).
    *   Locks the event row (`FOR UPDATE`) for race-safe transitions.
    *   Updates event state centrally (`status`, `current_question_index`, `question_end_at`, `results_announced`).
    *   Optionally syncs mode-specific session tables (competitive / treasure) when they are available.

*   **State Versioning for Realtime Consistency**
    *   `events.state_version` and trigger `bump_event_state_version()` provide monotonic version bumps for meaningful state changes.
    *   `events.controller_updated_at` tracks latest server-side control timestamp.
    *   Frontend listeners can safely reject stale updates by comparing version numbers.

*   **Scalability & Sync Indexes**
    *   Added indexes for event synchronization and participation lookups:
      *   `(id, state_version, status, current_question_index, question_end_at)` on `events`
      *   `(event_id, user_id, status)` on `participation`

This architecture ensures all critical state transitions are server-authoritative while game-mode engines remain specialized execution workers.
