import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store';
import { serverNow } from '../../lib/supabase';

/**
 * LiveBanner — Feature 1
 * Global fixed banner shown on ALL pages when a live event is running.
 * Reads from liveEventRuntime in Zustand (written every second by LiveEvent).
 * Clicking navigates to /live/:id.
 * Hidden on /live/ pages (already there), /admin/, /login, /signup.
 */
export function LiveBanner() {
  const runtime = useStore((state) => state.liveEventRuntime);
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show if no live runtime
  if (!runtime?.eventId) return null;

  // Don't show on the live event page itself, admin pages, auth pages
  const hiddenPaths = ['/live/', '/admin', '/login', '/signup'];
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null;

  const { eventId, eventTitle, status, currentQuestionIndex, totalQuestions, questionEndAt, timeLeftStr } = runtime;
  const remainingMs = questionEndAt ? Math.max(0, new Date(questionEndAt).getTime() - serverNow()) : null;
  const remainingStr = remainingMs !== null
    ? `${Math.max(0, Math.floor(remainingMs / 1000))}s`
    : timeLeftStr;

  return (
    <div
      onClick={() => navigate(`/live/${eventId}`)}
      className="live-banner live-banner--fixed"
      role="button"
      aria-label={`Join live event: ${eventTitle}`}
    >
      {/* Pulsing dot */}
      <span className="live-banner-dot-wrap">
        <span className="live-banner-dot-ping" />
        <span className="live-banner-dot" />
      </span>

      {/* Event title */}
      <span className="live-banner-title">
        {String(status || 'live').toUpperCase()}: {eventTitle || 'Event in Progress'}
      </span>

      {/* Q progress */}
      {totalQuestions > 0 && (
        <span className="live-banner-q">
          Q {(currentQuestionIndex || 0) + 1}/{totalQuestions}
        </span>
      )}

      {/* Time left */}
      {timeLeftStr && (
        <span className="live-banner-time">
          ⏱ {remainingStr || timeLeftStr}
        </span>
      )}

      {/* CTA */}
      <span className="live-banner-cta">
        Enter Arena →
      </span>
    </div>
  );
}
