/**
 * 🚀 Moonshot: Fourier Positional Encoding
 * 
 * Maps 2D coordinates (x, y) to a high-dimensional frequency space.
 * Used in Transformer Positional Encoding, NeRFs, and modern Generative AI.
 * 
 * Theory: gamma(p) = [sin(2^0 * pi * p), cos(2^0 * pi * p), ..., sin(2^L-1 * pi * p), cos(2^L-1 * pi * p)]
 */

export class FourierEncoder {
    private frequencies: number[];
    private L: number;

    constructor(L: number = 4) {
        this.L = L;
        this.frequencies = [];
        for (let i = 0; i < L; i++) {
            this.frequencies.push(Math.pow(2, i) * Math.PI);
        }
    }

    /**
     * Encodes a normalized coordinate (0-1) into Fourier features
     * @param x Normalized X
     * @param y Normalized Y
     * @returns Float32Array of size 4 * L
     */
    encode(x: number, y: number): Float32Array {
        const result = new Float32Array(this.L * 4);
        let idx = 0;

        for (const freq of this.frequencies) {
            result[idx++] = Math.sin(freq * x);
            result[idx++] = Math.cos(freq * x);
            result[idx++] = Math.sin(freq * y);
            result[idx++] = Math.cos(freq * y);
        }

        return result;
    }

    /**
     * Fast dot product between two fourier encodings
     * This measures "harmonic spatial similarity"
     */
    static similarity(v1: Float32Array, v2: Float32Array): number {
        let dot = 0;
        for (let i = 0; i < v1.length; i++) {
            dot += v1[i] * v2[i];
        }
        return dot / (v1.length / 2); // Normalize by number of components
    }
}
