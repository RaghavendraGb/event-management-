import { useNavigate } from 'react-router-dom';

/**
 * Individual topic card used in mind map + mobile grid fallback.
 * Props:
 *  - topic: { id, name, icon_url, color }
 *  - style: additional CSS for positioning inside SVG/canvas
 */
export function TopicCard({ topic, style = {}, className = '' }) {
  const navigate = useNavigate();

  return (
    <div
      className={`topic-card ${className}`}
      style={{
        '--topic-color': topic.color || '#3b82f6',
        ...style,
      }}
      onClick={() => navigate(`/ece/topic/${topic.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/ece/topic/${topic.id}`)}
      title={topic.name}
    >
      {topic.icon_url ? (
        <img
          src={topic.icon_url}
          alt={topic.name}
          className="w-10 h-10 object-contain rounded-lg"
          loading="lazy"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
          style={{ background: topic.color || '#3b82f6' }}
        >
          {topic.name.charAt(0)}
        </div>
      )}
      <span className="topic-card-label">{topic.name}</span>
    </div>
  );
}
