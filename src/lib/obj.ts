export interface ObjPart {
  name: string;
  data: Uint8Array;
  offset?: [number, number, number];
}

function cleanName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 60) || "pieza";
}

/** Convert binary STL parts to one OBJ, preserving part groups and offsets. */
export function binaryStlsToObj(parts: ObjPart[]): string {
  const lines: string[] = [
    "# CalicoCutters OBJ",
    "# Cortador y sello en el mismo archivo",
  ];
  let vertexBase = 1;
  for (const part of parts) {
    if (part.data.length < 84) continue;
    const view = new DataView(part.data.buffer, part.data.byteOffset, part.data.byteLength);
    const count = view.getUint32(80, true);
    if (84 + count * 50 > part.data.length) continue;
    const offset = part.offset ?? [0, 0, 0];
    lines.push(`o ${cleanName(part.name)}`);
    const vertices = new Map<string, number>();
    const faces: string[] = [];
    for (let triangle = 0; triangle < count; triangle += 1) {
      const record = 84 + triangle * 50;
      const indices: number[] = [];
      for (let point = 0; point < 3; point += 1) {
        const base = record + 12 + point * 12;
        const x = view.getFloat32(base, true) + offset[0];
        const y = view.getFloat32(base + 4, true) + offset[1];
        const z = view.getFloat32(base + 8, true) + offset[2];
        const key = `${x.toFixed(4)}|${y.toFixed(4)}|${z.toFixed(4)}`;
        let index = vertices.get(key);
        if (index === undefined) {
          index = vertexBase + vertices.size;
          vertices.set(key, index);
          lines.push(`v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`);
        }
        indices.push(index);
      }
      faces.push(`f ${indices[0]} ${indices[1]} ${indices[2]}`);
    }
    lines.push(...faces);
    vertexBase += vertices.size;
  }
  return `${lines.join("\n")}\n`;
}
