/** Default hero illustration shown until an admin uploads a real image
 * (see /team -> "Landing Page Image"). An original vector graphic, not a
 * copy of any photo -- abstract connected nodes in the app's own palette. */
export function NetworkIllustration() {
  const nodes = [
    [40, 60], [120, 30], [200, 80], [280, 40], [340, 110],
    [70, 150], [160, 170], [250, 190], [320, 200], [30, 220],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 6], [2, 6],
    [6, 7], [7, 8], [3, 8], [5, 9], [5, 6], [4, 8],
  ];

  return (
    <svg viewBox="0 0 380 260" className="h-full w-full" role="img" aria-label="Connected contact network illustration">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="380" height="260" rx="16" fill="url(#bg)" />
      <rect width="380" height="260" rx="16" fill="url(#glow)" />
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a][0]}
          y1={nodes[a][1]}
          x2={nodes[b][0]}
          y2={nodes[b][1]}
          stroke="#ffffff"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 7 : 5}
          fill={i % 3 === 0 ? "#fbbf24" : "#ffffff"}
          fillOpacity={i % 3 === 0 ? 1 : 0.9}
        />
      ))}
    </svg>
  );
}
