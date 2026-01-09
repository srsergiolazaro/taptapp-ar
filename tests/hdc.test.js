import { describe, it, expect } from 'vitest';
import { generateBasis, projectDescriptor, compressToSignature } from '../src/core/matching/hdc.js';

describe('Hyperdimensional Computing (HDC)', () => {
    it('should generate a deterministic basis', () => {
        const seed = 0x1234;
        const basis1 = generateBasis(seed, 10);
        const basis2 = generateBasis(seed, 10);

        expect(basis1.length).toBe(10);
        expect(basis1[0]).toEqual(basis2[0]);
    });

    it('should project and compress descriptors consistently', () => {
        const basis = generateBasis(0x1337BEEF, 1024);
        const desc = new Uint32Array([0x12345678, 0x9ABCDEF0]);

        const hv1 = projectDescriptor(desc, basis);
        const hv2 = projectDescriptor(desc, basis);

        expect(hv1).toEqual(hv2);

        const sig1 = compressToSignature(hv1);
        const sig2 = compressToSignature(hv2);

        expect(sig1).toBe(sig2);
    });

    it('should maintain similarity (LSH property in HDC space)', () => {
        const basis = generateBasis(0x1337BEEF, 1024);
        const d1 = new Uint32Array([0xFFFFFFFF, 0xFFFFFFFF]);
        const d2 = new Uint32Array([0xFFFFFFFE, 0xFFFFFFFF]); // 1 bit diff
        const d3 = new Uint32Array([0x00000000, 0x00000000]); // completely diff

        const hv1 = projectDescriptor(d1, basis);
        const hv2 = projectDescriptor(d2, basis);
        const hv3 = projectDescriptor(d3, basis);

        /**
         * @param {Uint32Array} v1
         * @param {Uint32Array} v2
         * @returns {number}
         */
        const hamming = (v1, v2) => {
            let dist = 0;
            /**
             * @param {number} n
             * @returns {number}
             */
            const popcount = (n) => {
                n = n - ((n >> 1) & 0x55555555);
                n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
                return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
            };
            for (let i = 0; i < v1.length; i++) {
                dist += popcount(v1[i] ^ v2[i]);
            }
            return dist;
        };

        const dist12 = hamming(hv1, hv2);
        const dist13 = hamming(hv1, hv3);

        console.log(`HDC Dist (Similar): ${dist12}`);
        console.log(`HDC Dist (Different): ${dist13}`);

        expect(dist12).toBeLessThan(dist13);
    });
});
