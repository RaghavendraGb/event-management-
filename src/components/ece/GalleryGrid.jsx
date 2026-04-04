import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Responsive photo gallery grid with CSS lightbox.
 * Props:
 *  - photos: array of { id, title, image_url, category }
 */
export function GalleryGrid({ photos = [] }) {
  const [lightbox, setLightbox] = useState(null);

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p>No photos yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <>
      {/* Grid */}
      <div className="gallery-grid">
        {photos.map((photo) => (
          <button
            key={photo.id}
            className="gallery-item"
            onClick={() => setLightbox(photo)}
            title={photo.title}
          >
            <img
              src={photo.image_url}
              alt={photo.title}
              loading="lazy"
              className="gallery-img"
            />
            <div className="gallery-overlay">
              <span className="gallery-title">{photo.title}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="gallery-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo lightbox"
        >
          <button
            className="gallery-lightbox-close"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="gallery-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.image_url}
              alt={lightbox.title}
              className="gallery-lightbox-img"
            />
            {lightbox.title && (
              <p className="text-center text-sm text-slate-300 mt-3 px-4">{lightbox.title}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
