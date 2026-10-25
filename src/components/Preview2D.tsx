import type { DesignShape, Ring } from "../types";

function pathOf(ring: Ring): string {
  if (!ring.length) return "";
  return ring
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(3)} ${y.toFixed(3)}`)
    .join(" ") + " Z";
}

export default function Preview2D({ shape, lineWidth }: { shape: DesignShape; lineWidth: number }) {
  const b = shape.bounds;
  const pad = Math.max(8, Math.max(b.width, b.height) * 0.12);
  const minX = b.minX - pad;
  const minY = b.minY - pad;
  const w = Math.max(1, b.width + pad * 2);
  const h = Math.max(1, b.height + pad * 2);
  const body = pathOf(shape.outer);
  const holes = shape.holes.map(pathOf).join(" ");
  const details = shape.details.map(pathOf).join(" ");

  return (
    <div className="preview2d-wrap">
      <div className="preview2d-paper">
        <svg viewBox={`${minX} ${minY} ${w} ${h}`} role="img" aria-label="Vista 2D del contorno">
          {shape.previewUrl && (
            <image
              href={shape.previewUrl}
              x={b.minX}
              y={b.minY}
              width={b.width}
              height={b.height}
              opacity="0.14"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
          <g>
            <path d={`${body} ${holes}`.trim()} fill="#f8b7c8" fillRule="evenodd" opacity="0.7" />
            <path d={`${body} ${holes}`.trim()} fill="none" stroke="#d94f6a" strokeWidth={Math.max(0.3, lineWidth * 0.7)} strokeLinejoin="round" />
            {details && (
              <path
                d={details}
                fill="#b7a4e8"
                fillRule="evenodd"
                opacity="0.6"
                stroke="#8d72c9"
                strokeWidth={Math.max(0.2, lineWidth * 0.45)}
              />
            )}
          </g>
          <line x1={b.minX} y1={b.maxY + pad * 0.45} x2={b.maxX} y2={b.maxY + pad * 0.45} stroke="#a4889b" strokeWidth={0.35} />
          <text x={b.minX + b.width / 2} y={b.maxY + pad * 0.45 + pad * 0.38} fontSize={pad * 0.34} fill="#8f7384" textAnchor="middle">
            {b.width.toFixed(1)} mm
          </text>
          <line x1={b.minX - pad * 0.45} y1={b.minY} x2={b.minX - pad * 0.45} y2={b.maxY} stroke="#a4889b" strokeWidth={0.35} />
          <text
            x={b.minX - pad * 0.65}
            y={b.minY + b.height / 2}
            fontSize={pad * 0.34}
            fill="#8f7384"
            textAnchor="middle"
            transform={`rotate(-90 ${b.minX - pad * 0.65} ${b.minY + b.height / 2})`}
          >
            {b.height.toFixed(1)} mm
          </text>
        </svg>
      </div>
      <div className="preview2d-foot">
        <span className="dot-pink" /> Silueta que corta
        <span className="dot-lilac" /> Detalle del sello
        <span className="preview2d-scale">línea {lineWidth.toFixed(2)} mm</span>
      </div>
    </div>
  );
}
