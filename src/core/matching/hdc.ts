/**
 * Hyperdimensional Computing (HDC) Core for AR
 * 
 * Provides ultra-fast, ultra-compressed feature matching using 
 * High-Dimensional Random Vectors.
 */

export const HDC_DIMENSION = 1024; // bits
export const HDC_WORDS = HDC_DIMENSION / 32;

/**
 * Deterministic Random Number Generator (PCG-like)
 */
class PRNG {
    state: number;
    constructor(seed: number) {
        this.state = seed;
    }
    next() {
        this.state = (this.state * 1664525 + 1013904223) >>> 0;
        return this.state / 0xFFFFFFFF;
    }
}

/**
 * Generates a deterministic basis of Hypervectors
 */
export function generateBasis(seed: number, count: number): Uint32Array[] {
    const prng = new PRNG(seed);
    const basis: Uint32Array[] = [];
    for (let i = 0; i < count; i++) {
        const hv = new Uint32Array(HDC_WORDS);
        for (let j = 0; j < HDC_WORDS; j++) {
            hv[j] = (prng.next() * 0xFFFFFFFF) >>> 0;
        }
        basis.push(hv);
    }
    return basis;
}

/**
 * Projects a 64-bit descriptor into the Hyperdimensional Space
 * Uses "Random Projection" logic (Locality Sensitive Hashing in HDC)
 */
export function projectDescriptor(desc: Uint32Array, basis: Uint32Array[]): Uint32Array {
    const result = new Uint32Array(HDC_WORDS);

    // For each bit in the HDC space
    for (let i = 0; i < HDC_DIMENSION; i++) {
        const wordIdx = i >>> 5;
        const bitIdx = i & 31;

        // This is a simplified random projection
        // In a real HDC system, we'd use more complex binding
        // But for Vanilla JS performance, we use bitwise voting
        let sum = 0;
        const b = basis[i % basis.length];

        // Dot product between descriptor and basis vector (subset)
        // desc[0] and desc[1] are the 64 bits
        for (let j = 0; j < 2; j++) {
            sum += popcount(desc[j] & b[j]);
        }

        if (sum > 16) { // Threshold for "firing"
            result[wordIdx] |= (1 << bitIdx);
        }
    }

    return result;
}

/**
 * Compresses an HDC vector into an "Ultra-Short Signature" (32 bits)
 * This allows storing 1000 points in just 4KB of descriptors.
 */
export function compressToSignature(hv: Uint32Array): number {
    // FNV-1a Hash for robust 32-bit compression
    let h1 = 0x811c9dc5;
    for (let i = 0; i < hv.length; i++) {
        h1 ^= hv[i];
        h1 = Math.imul(h1, 0x01000193);
    }
    return h1 >>> 0;
}

function popcount(n: number): number {
    n = n - ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
}

/**
 * Bundles multiple points into a single Global Hypervector (The "Image DNA")
 * This allows checking if an image is present with ONE vector comparison.
 */
export function bundle(hvs: Uint32Array[]): Uint32Array {
    const global = new Uint32Array(HDC_WORDS);
    const threshold = hvs.length / 2;
    const counters = new Uint16Array(HDC_DIMENSION);

    for (const hv of hvs) {
        for (let i = 0; i < HDC_DIMENSION; i++) {
            if (hv[i >>> 5] & (1 << (i & 31))) {
                counters[i]++;
            }
        }
    }

    for (let i = 0; i < HDC_DIMENSION; i++) {
        if (counters[i] > threshold) {
            global[i >>> 5] |= (1 << (i & 31));
        }
    }

    return global;
}
