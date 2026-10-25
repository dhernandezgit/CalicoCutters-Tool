export interface StlSource {
  data: Uint8Array;
  offset?: [number, number, number];
}

/** Merge binary STL files into one STL, applying each part's preview offset. */
export function combineBinaryStls(sources: StlSource[]): Uint8Array {
  const valid = sources.filter((source) => source.data.length >= 84);
  if (!valid.length) return new Uint8Array(0);
  let triangles = 0;
  const counts = valid.map((source) => {
    const view = new DataView(source.data.buffer, source.data.byteOffset, source.data.byteLength);
    const count = view.getUint32(80, true);
    const expected = 84 + count * 50;
    const safe = expected <= source.data.length ? count : 0;
    triangles += safe;
    return safe;
  });
  const output = new Uint8Array(84 + triangles * 50);
  const header = "CalicoCutters - piezas combinadas";
  for (let i = 0; i < Math.min(80, header.length); i += 1) output[i] = header.charCodeAt(i);
  const outView = new DataView(output.buffer);
  outView.setUint32(80, triangles, true);
  let write = 84;
  for (let index = 0; index < valid.length; index += 1) {
    const source = valid[index];
    const count = counts[index];
    if (!count) continue;
    const offset = source.offset ?? [0, 0, 0];
    if (!offset[0] && !offset[1] && !offset[2]) {
      output.set(source.data.subarray(84, 84 + count * 50), write);
      write += count * 50;
      continue;
    }
    const view = new DataView(source.data.buffer, source.data.byteOffset, source.data.byteLength);
    for (let tri = 0; tri < count; tri += 1) {
      const record = 84 + tri * 50;
      for (let f = 0; f < 12; f += 1) {
        const byte = record + f * 4;
        if (f < 3) {
          outView.setFloat32(write + f * 4, view.getFloat32(byte, true), true);
        } else {
          const axis = (f - 3) % 3;
          outView.setFloat32(write + f * 4, view.getFloat32(byte, true) + offset[axis], true);
        }
      }
      outView.setUint16(write + 48, view.getUint16(record + 48, true), true);
      write += 50;
    }
  }
  return output;
}
