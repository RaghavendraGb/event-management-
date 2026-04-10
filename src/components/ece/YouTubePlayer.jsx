import { useState } from 'react';
import { Play } from 'lucide-react';

/**
 * Lazy YouTube embed player.
 * Shows thumbnail first; clicking loads the actual iframe.
 * Maintains 16:9 aspect ratio on all screen sizes.
 *
 * Props:
 *  - youtubeId: string (e.g. 'dQw4w9WgXcQ')
 *  - title: string
 */
export function YouTubePlayer({ youtubeId, title = 'Video' }) {
  const [playing, setPlaying] = useState(false);

  if (!youtubeId) return null;

  const thumbUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;

  return (
    <div className="yt-player-wrap">
      {playing ? (
        <iframe
          className="yt-player-frame"
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div
          className="yt-player-thumb"
          onClick={() => setPlaying(true)}
          role="button"
          aria-label={`Play ${title}`}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setPlaying(true)}
        >
          <img
            src={thumbUrl}
            alt={title}
            className="yt-player-thumb-img"
            loading="lazy"
            onError={(e) => {
              e.target.src = `https://img.youtube.com/vi/${youtubeId}/sddefault.jpg`;
            }}
          />
          <div className="yt-player-overlay">
            <div className="yt-play-btn">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Extract YouTube video ID from various URL formats.
 * e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ → dQw4w9WgXcQ
 */
