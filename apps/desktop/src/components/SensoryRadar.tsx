import type { SensoryAxes } from "@werb/types";

/**
 * SVG radar chart for a 7-axis beer sensory profile. Matches the
 * "hop profile" visual brewers see in supplier catalogs (Yakima Chief
 * et al.) — labeled axes radiating from a center, concentric grid
 * rings every step, the values drawn as a filled polygon.
 *
 * Pure presentational. The caller passes the axes object plus an
 * optional comparison overlay (e.g. style guideline or previous
 * brew's profile).
 */

export const SENSORY_AXES: ReadonlyArray<{ key: keyof SensoryAxes; label: string }> = [
  { key: "bitterness", label: "Bitter" },
  { key: "hop_character", label: "Hop" },
  { key: "sourness", label: "Sour" },
  { key: "carbonation", label: "Carb" },
  { key: "body", label: "Body" },
  { key: "malt_character", label: "Malt" },
  { key: "sweetness", label: "Sweet" },
];

interface SensoryRadarProps {
  axes: SensoryAxes;
  // Optional second profile to overlay (drawn with a different stroke
  // but no fill). Used on the recipe screen to compare current brew
  // against a previous tasting.
  overlay?: SensoryAxes;
  size?: number;
  // 0–5 max per axis; matches the schema bounds. Surfaced as a prop
  // so future axes with different ranges (e.g. astringency 0–3) can
  // share the component.
  maxValue?: number;
}

const ANGLE_OFFSET = -Math.PI / 2; // First axis points UP.

function pointFor(
  i: number,
  total: number,
  value: number,
  maxValue: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const angle = ANGLE_OFFSET + (i / total) * Math.PI * 2;
  const r = (Math.max(0, Math.min(maxValue, value)) / maxValue) * radius;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function polygonPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  const head = `M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`;
  const tail = points
    .slice(1)
    .map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  return `${head} ${tail} Z`;
}

export function SensoryRadar({
  axes,
  overlay,
  size = 220,
  maxValue = 5,
}: SensoryRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 24; // leave room for labels at the edges
  const total = SENSORY_AXES.length;

  // Pre-compute axis endpoints and label anchors.
  const axisEnds = SENSORY_AXES.map((_, i) =>
    pointFor(i, total, maxValue, maxValue, radius, cx, cy),
  );
  const labelAnchors = SENSORY_AXES.map((_, i) =>
    pointFor(i, total, maxValue * 1.18, maxValue, radius, cx, cy),
  );

  // Concentric rings at each integer step.
  const rings = Array.from({ length: maxValue }, (_, ring) =>
    SENSORY_AXES.map((_, i) =>
      pointFor(i, total, ring + 1, maxValue, radius, cx, cy),
    ),
  );

  const valuePoints = SENSORY_AXES.map(({ key }, i) =>
    pointFor(i, total, axes[key], maxValue, radius, cx, cy),
  );
  const overlayPoints = overlay
    ? SENSORY_AXES.map(({ key }, i) =>
        pointFor(i, total, overlay[key], maxValue, radius, cx, cy),
      )
    : null;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Sensory profile"
      className="select-none"
    >
      {/* Grid: concentric rings. Outer ring slightly stronger for the
          chart boundary. */}
      {rings.map((ring, i) => (
        <polygon
          key={i}
          points={ring.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={i === rings.length - 1 ? 0.35 : 0.12}
          strokeWidth={1}
          className="text-text-muted"
        />
      ))}

      {/* Axis spokes. */}
      {axisEnds.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={1}
          className="text-text-muted"
        />
      ))}

      {/* Overlay (previous brew / style target). */}
      {overlayPoints && (
        <path
          d={polygonPath(overlayPoints)}
          fill="none"
          stroke="currentColor"
          strokeDasharray="3 3"
          strokeWidth={1.5}
          className="text-text-muted"
        />
      )}

      {/* Value polygon — the headline shape. */}
      <path
        d={polygonPath(valuePoints)}
        fill="currentColor"
        fillOpacity={0.25}
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-accent"
      />

      {/* Value dots at each vertex so a zero-valued axis still reads as
          a point on the center, and small ratings stay visible. */}
      {valuePoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2.5}
          fill="currentColor"
          className="text-accent"
        />
      ))}

      {/* Axis labels. */}
      {SENSORY_AXES.map((axis, i) => {
        const a = labelAnchors[i]!;
        // Horizontal alignment per quadrant so labels don't crowd the
        // chart on the left/right; the math is just sign-of-cos.
        const angle = ANGLE_OFFSET + (i / total) * Math.PI * 2;
        const cos = Math.cos(angle);
        const anchor =
          cos > 0.2 ? "start" : cos < -0.2 ? "end" : "middle";
        return (
          <text
            key={axis.key}
            x={a.x}
            y={a.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-text-muted font-mono"
            style={{ fontSize: 10 }}
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

export const EMPTY_AXES: SensoryAxes = {
  bitterness: 0,
  sweetness: 0,
  sourness: 0,
  hop_character: 0,
  malt_character: 0,
  body: 0,
  carbonation: 0,
};
