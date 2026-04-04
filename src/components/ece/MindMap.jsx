import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Interactive SVG mind map.
 * Center node: "Embedded Systems" — topic nodes orbit around it.
 * Positions driven by position_x/position_y in ece_topics.
 * On mobile (<640px), collapses to a scrollable grid of TopicCard.
 *
 * Props:
 *  - topics: array of { id, name, icon_url, color, position_x, position_y }
 */
export function MindMap({ topics = [] }) {
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  if (isMobile) {
    // Mobile fallback: scrollable grid
    return (
      <div className="grid grid-cols-2 gap-3 px-2 pb-6">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => navigate(`/ece/topic/${topic.id}`)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/10 bg-slate-800/60 hover:border-blue-500/40 hover:bg-slate-800 transition-all"
            style={{ borderColor: `${topic.color || '#3b82f6'}33` }}
          >
            {topic.icon_url ? (
              <img src={topic.icon_url} alt={topic.name} className="w-12 h-12 object-contain rounded-xl" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white"
                style={{ background: topic.color || '#3b82f6' }}
              >
                {topic.name.charAt(0)}
              </div>
            )}
            <span className="text-xs font-semibold text-slate-200 text-center">{topic.name}</span>
          </button>
        ))}
        {topics.length === 0 && (
          <div className="col-span-2 text-center py-12 text-slate-500">
            <p className="text-sm">No topics yet. Admin will add them soon.</p>
          </div>
        )}
      </div>
    );
  }

  // Desktop: SVG mind map
  const W = 900;
  const H = 620;
  const CX = W / 2;
  const CY = H / 2;

  // Compute default positions if none set (circular layout)
  const topicsWithPos = topics.map((t, i) => {
    const hasPos = t.position_x !== 0 || t.position_y !== 0;
    if (hasPos) return t;
    const angle = (2 * Math.PI * i) / Math.max(topics.length, 1) - Math.PI / 2;
    const radius = 220;
    return {
      ...t,
      position_x: CX + Math.cos(angle) * radius,
      position_y: CY + Math.sin(angle) * radius,
    };
  });

  return (
    <div className="mindmap-container">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ maxHeight: '620px' }}
      >
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connecting lines */}
        {topicsWithPos.map((topic) => (
          <g key={`line-${topic.id}`}>
            <line
              x1={CX} y1={CY}
              x2={topic.position_x} y2={topic.position_y}
              stroke={topic.color || '#3b82f6'}
              strokeWidth="1.5"
              strokeOpacity="0.35"
              strokeDasharray="6 4"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0" to="-20"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </line>
            {/* Traveling dot */}
            <circle r="3" fill={topic.color || '#3b82f6'} opacity="0.7">
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                path={`M${CX},${CY} L${topic.position_x},${topic.position_y}`}
              />
            </circle>
          </g>
        ))}

        {/* Center node glow */}
        <circle cx={CX} cy={CY} r="60" fill="url(#centerGlow)" />
        <circle
          cx={CX} cy={CY} r="48"
          fill="#1e293b"
          stroke="#3b82f6"
          strokeWidth="2"
          filter="url(#glow)"
        />
        <text
          x={CX} y={CY - 8}
          textAnchor="middle"
          fill="#93c5fd"
          fontSize="11"
          fontWeight="bold"
          fontFamily="monospace"
        >
          Embedded
        </text>
        <text
          x={CX} y={CY + 8}
          textAnchor="middle"
          fill="#93c5fd"
          fontSize="11"
          fontWeight="bold"
          fontFamily="monospace"
        >
          Systems
        </text>

        {/* Topic nodes */}
        {topicsWithPos.map((topic) => {
          const tx = topic.position_x;
          const ty = topic.position_y;
          const color = topic.color || '#3b82f6';
          return (
            <g
              key={topic.id}
              className="mindmap-node"
              onClick={() => navigate(`/ece/topic/${topic.id}`)}
              style={{ cursor: 'pointer' }}
            >
              {/* Glow */}
              <circle cx={tx} cy={ty} r="34" fill={color} opacity="0.08" />
              {/* Card bg */}
              <rect
                x={tx - 44} y={ty - 28}
                width="88" height="56"
                rx="12"
                fill="#1e293b"
                stroke={color}
                strokeWidth="1.5"
                strokeOpacity="0.5"
              />
              {/* Icon or letter */}
              {topic.icon_url ? (
                <image
                  href={topic.icon_url}
                  x={tx - 14} y={ty - 22}
                  width="28" height="28"
                  clipPathUnits="userSpaceOnUse"
                />
              ) : (
                <text
                  x={tx} y={ty - 4}
                  textAnchor="middle"
                  fill={color}
                  fontSize="18"
                  fontWeight="bold"
                >
                  {topic.name.charAt(0)}
                </text>
              )}
              {/* Label */}
              <text
                x={tx} y={ty + 18}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="9.5"
                fontWeight="600"
              >
                {topic.name.length > 14 ? topic.name.slice(0, 13) + '…' : topic.name}
              </text>
            </g>
          );
        })}

        {topics.length === 0 && (
          <text x={CX} y={CY + 80} textAnchor="middle" fill="#475569" fontSize="13">
            No topics yet — admin will add them soon
          </text>
        )}
      </svg>
    </div>
  );
}
