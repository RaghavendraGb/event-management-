import { Link2, Code2, Phone, User } from 'lucide-react';

/**
 * Creator profile card.
 * Props:
 *  - creator: { name, role, photo_url, instagram, github, phone }
 */
export function CreatorCard({ creator }) {
  return (
    <div className="creator-card">
      {/* Photo */}
      <div className="creator-photo-wrap">
        {creator.photo_url ? (
          <img src={creator.photo_url} alt={creator.name} className="creator-photo" />
        ) : (
          <div className="creator-photo-placeholder">
            <User className="w-10 h-10 text-slate-500" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="creator-info">
        <h3 className="text-base font-bold text-slate-100">{creator.name}</h3>
        <p className="text-xs font-medium text-blue-400 mb-3">{creator.role}</p>

        {/* Social links */}
        <div className="flex flex-wrap gap-2 justify-center">
          {creator.instagram && (
            <a
              href={`https://instagram.com/${creator.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link social-link--instagram"
              aria-label="Instagram profile"
            >
              <Link2 className="w-4 h-4" />
              <span className="text-xs">{creator.instagram}</span>
            </a>
          )}
          {creator.github && (
            <a
              href={`https://github.com/${creator.github}`}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link social-link--github"
              aria-label="GitHub profile"
            >
              <Code2 className="w-4 h-4" />
              <span className="text-xs">{creator.github}</span>
            </a>
          )}
          {creator.phone && (
            <a
              href={`tel:${creator.phone}`}
              className="social-link social-link--phone"
              aria-label="Phone"
            >
              <Phone className="w-4 h-4" />
              <span className="text-xs">{creator.phone}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
