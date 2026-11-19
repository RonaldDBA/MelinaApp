import type { ExerciseVisual } from '@melina/shared';

/** Visual representations drawn in SVG/HTML (no external images). */
export function Visual({ v }: { v: ExerciseVisual }) {
  if (v.kind === 'emoji') {
    return (
      <div className="visual-emoji" role="img" aria-label={v.label ?? 'image'}>
        {v.emoji}
      </div>
    );
  }
  if (v.kind === 'text') {
    return (
      <article className="reading-text">
        <h3>{v.title}</h3>
        {v.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
    );
  }
  if (v.kind === 'tens-units') {
    const cell = 12;
    const bars = Array.from({ length: v.tens });
    const units = Array.from({ length: v.units });
    const width = v.tens * (cell + 14) + 30 + Math.ceil(v.units / 5) * (cell + 6) + 10;
    return (
      <svg className="visual-svg" viewBox={`0 0 ${Math.max(width, 120)} ${cell * 10 + 20}`} role="img" aria-label={`${v.tens} barres de dix et ${v.units} cubes`}>
        {bars.map((_, b) => (
          <g key={b} transform={`translate(${10 + b * (cell + 14)}, 10)`}>
            {Array.from({ length: 10 }).map((__, i) => (
              <rect key={i} x={0} y={i * cell} width={cell} height={cell} fill="#4f8fe0" stroke="#1f4f8f" strokeWidth={1.5} />
            ))}
          </g>
        ))}
        {units.map((_, u) => (
          <rect
            key={u}
            x={10 + v.tens * (cell + 14) + 20 + Math.floor(u / 5) * (cell + 6)}
            y={10 + (u % 5) * (cell + 6) + cell * 4}
            width={cell}
            height={cell}
            fill="#f2a33a"
            stroke="#a8641a"
            strokeWidth={1.5}
          />
        ))}
      </svg>
    );
  }
  // groups: dots arranged in rows of 10
  const rows = Math.ceil(v.total / v.perGroup);
  const r = 7;
  return (
    <svg className="visual-svg" viewBox={`0 0 ${v.perGroup * 22 + 20} ${rows * 22 + 20}`} role="img" aria-label={`${v.total} ${v.item}`}>
      {Array.from({ length: v.total }).map((_, i) => (
        <circle key={i} cx={20 + (i % v.perGroup) * 22} cy={20 + Math.floor(i / v.perGroup) * 22} r={r} fill="#e8505b" stroke="#9b2730" strokeWidth={1.5} />
      ))}
    </svg>
  );
}
