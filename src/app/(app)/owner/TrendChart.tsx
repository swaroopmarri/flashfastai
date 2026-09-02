export interface TrendPoint {
  date: string;
  count: number;
}

const COLOR_CLASSES: Record<"blue" | "orange", string> = {
  blue: "fill-blue-500",
  orange: "fill-orange-500",
};

/**
 * Static (no client JS) daily bar chart. Two of these are shown side by
 * side, each a single series -- never combined onto one dual-axis chart.
 * Native SVG <title> elements give a hover value per bar without needing
 * a client component.
 */
export function TrendChart({
  title,
  color,
  data,
}: {
  title: string;
  color: "blue" | "orange";
  data: TrendPoint[];
}) {
  const width = 600;
  const height = 120;
  const gap = 2;
  const barWidth = data.length ? width / data.length - gap : 0;
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <span className="text-xs text-gray-400">
          {total.toLocaleString("en-IN")} in last 30 days
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${title}: ${total} in the last 30 days`}
      >
        {data.map((d, i) => {
          const barHeight = Math.max((d.count / max) * (height - 16), 1);
          const x = i * (barWidth + gap);
          const y = height - barHeight;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={Math.max(barWidth, 1)}
              height={barHeight}
              rx={2}
              className={COLOR_CLASSES[color]}
            >
              <title>{`${d.date}: ${d.count}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
