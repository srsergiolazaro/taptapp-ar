
import { OfflineCompiler } from '../src/compiler/offline-compiler.ts';
import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_PATH = path.join(__dirname, 'assets', 'test-image.png');

async function run() {
    console.log("Reading image:", IMAGE_PATH);
    const image = await Jimp.read(IMAGE_PATH);
    const { width, height, data } = image.bitmap;

    const compiler = new OfflineCompiler();

    console.log("Compiling...");
    const results = await compiler.compileImageTargets([
        { width, height, data: new Uint8Array(data) }
    ], (p) => { });

    const target = results[0];
    console.log("\n--- Layer Diagnostics (Tracking Data) ---");
    console.log(`Original Size: ${width}x${height}`);

    target.trackingData.forEach((layer, i) => {
        // En el formato interno de trackingData, los puntos suelen estar en layer.points
        const pointCount = layer.points ? layer.points.length : 0;
        const scale = layer.scale || layer.s || 'unknown';
        const w = layer.width || layer.w;
        const h = layer.height || layer.h;

        console.log(`Layer ${i.toString().padStart(2)} | Scale: ${scale.toFixed(4).padEnd(6)} | Res: ${w.toString().padStart(4)}x${h.toString().padStart(4)} | Points: ${pointCount}`);
    });

    console.log("\n--- Matching Data (Keyframes) ---");
    target.matchingData.forEach((kf, i) => {
        const maximaCells = kf.maximaPoints ? kf.maximaPoints.length : 0;
        const minimaCells = kf.minimaPoints ? kf.minimaPoints.length : 0;
        console.log(`Keyframe ${i} | Res: ${kf.width}x${kf.height} | Scale: ${kf.scale.toFixed(4)} | Maxima: ${maximaCells} | Minima: ${minimaCells}`);
    });
}

run().catch(console.error);
