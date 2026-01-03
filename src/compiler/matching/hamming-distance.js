// Precomputed bit count lookup table for Uint8Array (Much faster than bit manipulation)
const BIT_COUNT_8 = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let c = 0, n = i;
  while (n > 0) { n &= (n - 1); c++; }
  BIT_COUNT_8[i] = c;
}

const compute = (options) => {
  const { v1, v2, v1Offset = 0, v2Offset = 0 } = options;
  let d = 0;
  // FREAK descriptors are 84 bytes
  for (let i = 0; i < 84; i++) {
    d += BIT_COUNT_8[v1[v1Offset + i] ^ v2[v2Offset + i]];
  }
  return d;
};

export { compute };
