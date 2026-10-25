/** Merge binary STL files into one STL without changing any triangle. */
export function combineBinaryStls(buffers: Uint8Array[]): Uint8Array {
  const valid = buffers.filter((buffer) => buffer.length >= 84);
  if (!valid.length) return new Uint8Array(0);
  if (valid.length === 1) return valid[0];
  let triangles = 0;
  const counts = valid.map((buffer) => {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const count = view.getUint32(80, true);
    const expected = 84 + count * 50;
    const safe = expected <= buffer.length ? count : 0;
    triangles += safe;
    return safe;
  });
  const output = new Uint8Array(84 + triangles * 50);
  const header = "CalicoCutters - cortador y sello combinados";
  for (let i = 0; i < Math.min(80, header.length); i += 1) output[i] = header.charCodeAt(i);
  new DataView(output.buffer).setUint32(80, triangles, true);
  let write = 84;
  for (let i = 0; i < valid.length; i += 1) {
    const count = counts[i];
    if (!count) continue;
    output.set(valid[i].subarray(84, 84 + count * 50), write);
    write += count * 50;
  }
  return output;
}
