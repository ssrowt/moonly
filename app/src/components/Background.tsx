import { useMemo } from 'react';
import './Background.css';

function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    x: +((i * 137.508 + 23) % 100).toFixed(2),
    y: +((i * 97.353 + 37) % 100).toFixed(2),
    R: +(0.55 + (i % 6) * 0.18).toFixed(2),   // long arm radius
    opacity: +(0.4 + (i % 7) * 0.08).toFixed(2),
    delay: +((i % 11) * 0.55).toFixed(1),
    duration: +(2.5 + (i % 8) * 0.6).toFixed(1),
    bright: i % 10 === 0,
    rotation: (i * 17) % 45,  // slight rotation offset per star
  }));
}

/** Generate polygon points for an 8-pointed sparkle star */
function sparklePoints(cx: number, cy: number, R: number, rotation: number): string {
  const Rs = R * 0.28;   // diagonal arm length
  const Ri = R * 0.045;  // inner notch radius
  const rotRad = (rotation * Math.PI) / 180;
  const pts: string[] = [];

  for (let i = 0; i < 16; i++) {
    const angle = -Math.PI / 2 + i * (Math.PI / 8) + rotRad;
    let r: number;
    if (i % 2 === 1) {
      r = Ri;           // inner notch
    } else if (i % 4 === 0) {
      r = R;            // cardinal arm (long)
    } else {
      r = Rs;           // diagonal arm (shorter)
    }
    pts.push(
      `${(cx + Math.cos(angle) * r).toFixed(3)},${(cy + Math.sin(angle) * r).toFixed(3)}`
    );
  }
  return pts.join(' ');
}

export default function Background() {
  const stars = useMemo(() => generateStars(65), []);

  return (
    <div className="bg-layer" aria-hidden="true">
      <div className="bg-shimmer" />
      <div className="bg-orb" />
      <svg className="bg-stars" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* Gradient for bright star glow halos */}
          <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a8c8ff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#4f8ef7" stopOpacity="0" />
          </radialGradient>
        </defs>

        {stars.map((s, i) => (
          <g key={i}>
            {/* Soft glow behind bright stars */}
            {s.bright && (
              <circle
                cx={s.x}
                cy={s.y}
                r={s.R * 5}
                fill="url(#starGlow)"
                className="star-halo"
                style={{
                  animationDelay: `${s.delay}s`,
                  animationDuration: `${s.duration}s`,
                }}
              />
            )}
            {/* 8-pointed sparkle star */}
            <polygon
              points={sparklePoints(s.x, s.y, s.R, s.rotation)}
              fill="white"
              opacity={s.opacity}
              className={`star ${s.bright ? 'star--bright' : ''}`}
              style={{
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.duration}s`,
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
