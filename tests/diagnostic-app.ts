import { DetectorLite } from "../src/core/detector/detector-lite.js";
import { InputLoader } from "../src/core/input-loader.js";
import { Matcher } from "../src/core/matching/matcher.js";
import { Estimator } from "../src/core/estimation/estimator.js";
import { buildModelViewProjectionTransform, computeScreenCoordiate } from "../src/core/estimation/utils.js";
import { decodeTaar } from "../src/core/protocol.js";
import { OfflineCompiler } from "../src/compiler/offline-compiler.js";
import { AR_CONFIG } from "../src/core/constants.js";

const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const btnRun = document.getElementById('btnRun') as HTMLButtonElement;
const mainCanvas = document.getElementById('mainCanvas') as HTMLCanvasElement;
const overlayCanvas = document.getElementById('overlayCanvas') as HTMLCanvasElement;
const mainCtx = mainCanvas.getContext('2d')!;
const overlayCtx = overlayCanvas.getContext('2d')!;
const logs = document.getElementById('diagnosticLogs') as HTMLElement;
const pyramidContainer = document.getElementById('pyramidContainer') as HTMLElement;

const statTarget = document.getElementById('statTarget') as HTMLElement;
const statMatches = document.getElementById('statMatches') as HTMLElement;
const statInliers = document.getElementById('statInliers') as HTMLElement;
const statConf = document.getElementById('statConf') as HTMLElement;

const WIDTH = AR_CONFIG.VIEWPORT_WIDTH;
const HEIGHT = AR_CONFIG.VIEWPORT_HEIGHT;

// Standard AR Camera Intrinsics (K)
const fovy = (AR_CONFIG.DEFAULT_FOVY * Math.PI) / 180;
const f = HEIGHT / 2 / Math.tan(fovy / 2);
const K = [
    [f, 0, WIDTH / 2],
    [0, f, HEIGHT / 2],
    [0, 0, 1],
];
const estimator = new Estimator(K);

mainCanvas.width = WIDTH;
mainCanvas.height = HEIGHT;
overlayCanvas.width = WIDTH;
overlayCanvas.height = HEIGHT;

let testImage: HTMLImageElement | null = null;
let targetData: any = null;

function log(msg: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') {
    const div = document.createElement('div');
    const colors = {
        'error': '#f44',
        'success': '#10b981',
        'warning': '#f59e0b',
        'info': '#ccc'
    };
    div.style.color = colors[type];
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.prepend(div);
}

fileInput.onchange = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            testImage = img;

            // Fix distortion: Center crop logic
            const imgAspect = img.width / img.height;
            const canvasAspect = WIDTH / HEIGHT;

            let sx, sy, sw, sh;
            if (imgAspect > canvasAspect) {
                // Image is wider than canvas
                sh = img.height;
                sw = img.height * canvasAspect;
                sx = (img.width - sw) / 2;
                sy = 0;
            } else {
                // Image is taller than canvas
                sw = img.width;
                sh = img.width / canvasAspect;
                sx = 0;
                sy = (img.height - sh) / 2;
            }

            mainCtx.fillStyle = '#000';
            mainCtx.fillRect(0, 0, WIDTH, HEIGHT);
            mainCtx.drawImage(img, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);

            log(`Image loaded: ${file.name} (Cropped to 4:3)`, 'success');
        };
        img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
};

// Manual TAAR loading removed in favor of auto-compilation


btnRun.onclick = async () => {
    if (!testImage) {
        log('No image loaded', 'error');
        return;
    }

    log('Starting continuous diagnostic loop...', 'info');
    pyramidContainer.innerHTML = '';

    const loader = new InputLoader(WIDTH, HEIGHT);
    const detector = new DetectorLite(WIDTH, HEIGHT, { useGPU: false, maxFeaturesPerBucket: AR_CONFIG.MAX_FEATURES_PER_BUCKET, useLSH: AR_CONFIG.USE_LSH });
    const matcher = new Matcher(WIDTH, HEIGHT, true);

    let isTracking = false;
    let lastPose: any = null;

    const runFrame = async () => {
        overlayCtx.clearRect(0, 0, WIDTH, HEIGHT);
        const greyData = loader.loadInput(mainCanvas as any);

        if (!isTracking) {
            // --- DETECTION PHASE ---
            const result = detector.detect(greyData) as any;
            if (targetData) {
                const matchingResult = matcher.matchDetection(targetData[0].matchingData, result.featurePoints);

                if (matchingResult.keyframeIndex !== -1 && matchingResult.screenCoords) {
                    const k = matchingResult.keyframeIndex;
                    log(`MATCH SUCCESS: Octave ${k}. Switching to Track...`, 'success');

                    lastPose = estimator.estimate({
                        screenCoords: matchingResult.screenCoords,
                        worldCoords: matchingResult.worldCoords
                    });

                    if (lastPose) {
                        isTracking = true;
                        visualizePose(lastPose, matchingResult.screenCoords);
                    }
                }
            }

            // Show pyramid only once to avoid flickering
            if (pyramidContainer.innerHTML === '' && result.pyramid) {
                renderPyramid(result.pyramid);
            }
        } else {
            // --- TRACKING SIMULATION PHASE ---
            // In a real video this would use the tracker.track() and refineEstimate()
            // Here we just re-run detection to show stability, but we follow the "Video" logic
            const result = detector.detect(greyData) as any;
            const matchingResult = matcher.matchDetection(targetData[0].matchingData, result.featurePoints);

            if (matchingResult.keyframeIndex !== -1) {
                const newPose = estimator.estimate({
                    screenCoords: matchingResult.screenCoords,
                    worldCoords: matchingResult.worldCoords
                });
                if (newPose && matchingResult.screenCoords) {
                    lastPose = newPose;
                    visualizePose(lastPose, matchingResult.screenCoords);
                }
            } else {
                isTracking = false;
                log('Tracking lost. Re-detecting...', 'warning');
            }
        }

        requestAnimationFrame(runFrame);
    };

    const visualizePose = (pose: any, inliers: any[]) => {
        statMatches.textContent = isTracking ? 'TRACKING' : 'FOUND';
        statInliers.textContent = inliers.length.toString();
        statConf.textContent = Math.min(100, (inliers.length / 15) * 100).toFixed(0) + '%';

        // Draw Inliers
        overlayCtx.fillStyle = '#0f0';
        inliers.forEach((p: any) => {
            overlayCtx.beginPath();
            overlayCtx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            overlayCtx.fill();
        });

        // Project Mesh
        const MVP = buildModelViewProjectionTransform(K, pose);
        const trackingData = targetData[0].trackingData[0]; // Oct 0 (256px usually)

        if (trackingData && trackingData.mesh) {
            const px = trackingData.px;
            const py = trackingData.py;
            const scale = trackingData.s; // 🚀 FIX: The scale of the tracking octave
            const triangles = trackingData.mesh.t;

            const projected = [];
            for (let i = 0; i < px.length; i++) {
                // 🎯 KEY FIX: Divide by scale to bring 256px-coords back to original image space
                const p = computeScreenCoordiate(MVP, px[i] / scale, py[i] / scale, 0);
                projected.push(p);
            }

            // Draw Mesh
            overlayCtx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
            overlayCtx.fillStyle = 'rgba(0, 255, 255, 0.2)';
            overlayCtx.lineWidth = 2;
            for (let i = 0; i < triangles.length; i += 3) {
                const p1 = projected[triangles[i]];
                const p2 = projected[triangles[i + 1]];
                const p3 = projected[triangles[i + 2]];
                if (!p1 || !p2 || !p3) continue;
                overlayCtx.beginPath();
                overlayCtx.moveTo(p1.x, p1.y);
                overlayCtx.lineTo(p2.x, p2.y);
                overlayCtx.lineTo(p3.x, p3.y);
                overlayCtx.closePath();
                overlayCtx.fill();
                overlayCtx.stroke();
            }
        }
    };

    const renderPyramid = (pyramid: any[]) => {
        pyramid.forEach((octave: any[], i: number) => {
            const img1 = octave[0];
            const img2 = octave[1];
            const item = document.createElement('div');
            item.className = 'octave-item';
            item.innerHTML = `<strong>Octave ${i} (Scale 1:${Math.pow(2, i)})</strong>`;
            const oCanvas = document.createElement('canvas');
            oCanvas.width = img1.width;
            oCanvas.height = img1.height;
            const oCtx = oCanvas.getContext('2d')!;
            const dogData = new Uint8ClampedArray(img1.width * img1.height * 4);
            let maxDiff = 0;
            for (let j = 0; j < img1.data.length; j++) {
                const diff = (img2.data[j] - img1.data[j]);
                const val = 128 + diff * 12;
                dogData[j * 4] = val; dogData[j * 4 + 1] = val; dogData[j * 4 + 2] = val; dogData[j * 4 + 3] = 255;
                if (Math.abs(diff) > maxDiff) maxDiff = Math.abs(diff);
            }
            oCtx.putImageData(new ImageData(dogData, img1.width, img1.height), 0, 0);
            item.appendChild(oCanvas);
            pyramidContainer.appendChild(item);
        });
    };

    runFrame();
};


// Help helper to load images as promises
function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
}

// Auto-start logic to save time
async function autoStart() {
    log('🚀 Initializing Deep Diagnostic Auto-Start...');

    try {
        // 1. Load and compile target
        const targetUrl = './assets/test-image.png';
        log(`📦 Auto-loading target: ${targetUrl}`);
        const targetImg = await loadImage(targetUrl);

        const canvas = document.createElement('canvas');
        canvas.width = targetImg.width;
        canvas.height = targetImg.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(targetImg, 0, 0);
        const imageData = ctx.getImageData(0, 0, targetImg.width, targetImg.height);

        const compiler = new OfflineCompiler();
        log('⚡ Compiling target in-browser...');
        await compiler.compileImageTargets([{
            data: new Uint8Array(imageData.data.buffer),
            width: targetImg.width,
            height: targetImg.height
        }], () => { });

        const taarBuffer = compiler.exportData();
        const decoded = decodeTaar(new Uint8Array(taarBuffer));
        targetData = decoded.dataList;
        statTarget.textContent = `Auto-Compiled (${targetData.length} targets)`;
        log('✅ Target compiled successfully', 'success');

        // 2. Load scene image
        const sceneUrl = './assets/WIN_20260108_16_58_09_Pro.jpg';
        log(`🖼️ Auto-loading scene: ${sceneUrl}`);
        const sceneImg = await loadImage(sceneUrl);
        testImage = sceneImg;

        const canvasAspect = WIDTH / HEIGHT;
        const imgAspect = sceneImg.width / sceneImg.height;
        let sx, sy, sw, sh;
        if (imgAspect > canvasAspect) {
            sh = sceneImg.height;
            sw = sceneImg.height * canvasAspect;
            sx = (sceneImg.width - sw) / 2;
            sy = 0;
        } else {
            sw = sceneImg.width;
            sh = sceneImg.width / canvasAspect;
            sx = 0;
            sy = (sceneImg.height - sh) / 2;
        }
        mainCtx.fillStyle = '#000';
        mainCtx.fillRect(0, 0, WIDTH, HEIGHT);
        mainCtx.drawImage(sceneImg, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
        log('✅ Scene image loaded', 'success');

        // 3. Run diagnostic
        log('🎬 Starting analysis...');
        btnRun.click();

    } catch (err: any) {
        log('❌ Auto-start failed: ' + err.message, 'error');
        console.error(err);
    }
}

// Kick it off
autoStart();
