import React, { useMemo } from 'react';

function generateTearPath(pointCount = 100) {
  const w = 1440;
  const points = [];
  const step = w / pointCount;

  for (let i = 0; i <= pointCount; i++) {
    const x = i * step + (Math.random() - 0.5) * step * 0.3;
    const y = 20 + Math.random() * 40 + Math.sin(i * 0.8) * 8;
    points.push([Math.max(0, Math.min(w, x)), y]);
  }

  const d = [
    `M 0 0`,
    `L 0 ${points[0][1]}`,
    ...points.map(([x, y]) => `L ${x} ${y}`),
    `L ${w} 0`,
    `Z`,
  ].join(" ");

  return d;
}

export default function PaperTear({ topColor = "#0A0A0A", bottomColor = "#FAF9F6", flip = false }) {
  const path = useMemo(() => generateTearPath(), []);
  return (
    <div style={{ background: bottomColor, marginTop: flip ? 0 : -1 }}>
      <svg
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: "60px",
                 transform: flip ? "scaleY(-1)" : "none" }}
      >
        <path d={path} fill={topColor} />
      </svg>
    </div>
  );
}
