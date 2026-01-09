import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import { OfflineCompiler } from '../dist/compiler/offline-compiler.js';
import { DetectorLite } from '../dist/core/detector/detector-lite.js';
import { Matcher } from '../dist/core/matching/matcher.js';
import { Estimator } from '../dist/core/estimation/estimator.js';
import { buildModelViewProjectionTransform, computeScreenCoordiate } from '../dist/core/estimation/utils.js';
import { decodeTaar } from '../dist/core/protocol.js';

async function run() {
    const ASSETS_DIR = 'tests/assets';
    const TARGET_IMG = path.join(ASSETS_DIR, 'test-image.png');
    const SCENE_IMG = path.join(ASSETS_DIR, 'WIN_20260108_16_58_09_Pro.jpg');
    const OUTPUT_IMG = 'pnp_verification_result.png';

    console.log('🚀 PNP CLI VERIFICATION');
    console.log('-----------------------');

    // 1. Compile Target
    console.log('📦 Step 1: Compiling Target (' + TARGET_IMG + ')...');
    const targetJimp = await Jimp.read(TARGET_IMG);
    const compiler = new OfflineCompiler();
    await compiler.compileImageTargets([{
        data: targetJimp.bitmap.data,
        width: targetJimp.bitmap.width,
        height: targetJimp.bitmap.height
    }], () => { });

    const taarBuffer = compiler.exportData();
    const taarData = decodeTaar(new Uint8Array(taarBuffer));
    const targetData = taarData.dataList;
    console.log('✅ Compilation done. HDC Signatures generated.');

    // 2. Load Scene
    console.log('🖼️ Step 2: Loading Scene (' + SCENE_IMG + ')...');
    const sceneJimp = await Jimp.read(SCENE_IMG);
    const WIDTH = sceneJimp.bitmap.width;
    const HEIGHT = sceneJimp.bitmap.height;

    const greyData = new Uint8Array(WIDTH * HEIGHT);
    for (let i = 0; i < greyData.length; i++) {
        const offset = i * 4;
        greyData[i] = Math.floor((sceneJimp.bitmap.data[offset] + sceneJimp.bitmap.data[offset + 1] + sceneJimp.bitmap.data[offset + 2]) / 3);
    }

    // 3. Detect
    console.log('🔍 Step 3: Detecting Features...');
    const detector = new DetectorLite(WIDTH, HEIGHT, { useLSH: true, maxFeaturesPerBucket: 40 });
    const { featurePoints } = detector.detect(greyData);
    console.log('✅ Features found: ' + featurePoints.length);
    // 4. Match
    console.log('🤝 Step 4: Matching (HDC)...');
    const matcher = new Matcher(WIDTH, HEIGHT, true);
    const matchingResult = matcher.matchDetection(targetData, featurePoints);

    if (!matchingResult || matchingResult.keyframeIndex === -1) {
        console.error('❌ FAILED: No target detected in the scene.');
        if (matchingResult && matchingResult.debugExtra && matchingResult.debugExtra.frames) {
            matchingResult.debugExtra.frames.forEach((frame, idx) => {
                console.log(`Frame ${idx}: Initial Matches: ${frame.constellationMatches ? frame.constellationMatches.length : 0}, Hough Matches: ${frame.houghMatches ? frame.houghMatches.length : 0}, Inliers: ${frame.inlierMatches ? frame.inlierMatches.length : 0}`);
            });
        }
        process.exit(1);
    }
    console.log('✅ Match success! Inliers: ' + matchingResult.screenCoords.length);

    // 5. Pose (PnP)
    console.log('📐 Step 5: Solving 3D Pose (PnP)...');
    const fovy = (45.0 * Math.PI) / 180;
    const f = HEIGHT / 2 / Math.tan(fovy / 2);
    const K = [
        [f, 0, WIDTH / 2],
        [0, f, HEIGHT / 2],
        [0, 0, 1],
    ];
    const estimator = new Estimator(K);
    const pose = estimator.estimate({
        screenCoords: matchingResult.screenCoords,
        worldCoords: matchingResult.worldCoords
    });

    if (!pose) {
        console.error('❌ FAILED: PnP Solver could not find a valid pose.');
        process.exit(1);
    }
    console.log('✅ Pose found.');

    // 6. Draw and Save
    console.log('🎨 Step 6: Generating Result Image (' + OUTPUT_IMG + ')...');
    const MVP = buildModelViewProjectionTransform(K, pose);
    const masterTracking = targetData[0].trackingData[0];

    // Create a result image (copy of scene)
    const resultJimp = sceneJimp.clone();

    // Draw mesh points
    if (masterTracking && masterTracking.mesh) {
        const px = masterTracking.px;
        const py = masterTracking.py;
        const triangles = masterTracking.mesh.t;

        const projected = [];
        for (let i = 0; i < px.length; i++) {
            const p = computeScreenCoordiate(MVP, px[i], py[i], 0);
            projected.push(p);

            // Draw vertex as a small green dot (3x3 for visibility)
            const x = Math.round(p.x);
            const y = Math.round(p.y);
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const px = x + dx;
                    const py = y + dy;
                    if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
                        resultJimp.setPixelColor(0x00FF00FF, px, py);
                    }
                }
            }
        }

        // Draw some connections (edges)
        const edges = masterTracking.mesh.e;
        for (let i = 0; i < edges.length; i += 2) {
            const p1 = projected[edges[i]];
            const p2 = projected[edges[i + 1]];
            if (!p1 || !p2) continue;

            // Draw a simple line (using Jimp.scan or similar is complex, let's just draw points for now
            // and save to verification)
        }
    }

    await resultJimp.write(OUTPUT_IMG);
    console.log('-----------------------');
    console.log('🏁 VERIFICATION FINISHED!');
    console.log('Image saved to: ' + path.resolve(OUTPUT_IMG));
}

run().catch(err => {
    console.error('💥 FATAL ERROR:', err);
    process.exit(1);
});
