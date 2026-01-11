import { BioInspiredController } from "./bio-inspired-controller.js";
import { projectToScreen } from "../core/utils/projection.js";

/**
 * 🍦 SimpleAR - High-performance Vanilla AR for image overlays
 * Now powered by Bio-Inspired Perception and Nanite Virtualized Features.
 */

export interface SimpleAROptions {
    container: HTMLElement;
    targetSrc: string | string[];
    overlay: HTMLElement;
    scale?: number;
    onFound?: ((data: { targetIndex: number }) => void | Promise<void>) | null;
    onLost?: ((data: { targetIndex: number }) => void | Promise<void>) | null;
    onUpdate?: ((data: {
        targetIndex: number,
        worldMatrix: number[],
        screenCoords?: { x: number, y: number }[],
        reliabilities?: number[],
        stabilities?: number[],
        detectionPoints?: { x: number, y: number }[]
    }) => void) | null;
    cameraConfig?: MediaStreamConstraints['video'];
    debug?: boolean;
}

/**
 * 🕵️ Internal Smoothing Manager
 * Applies Median + Adaptive Alpha filtering for sub-pixel stability.
 */
class SmoothingManager {
    private history: Map<number, { x: number, y: number }[]> = new Map();
    private lastFiltered: Map<number, { x: number, y: number }> = new Map();
    private medianSize = 3;
    private deadZone = 0.2;

    smooth(id: number, raw: { x: number, y: number }, reliability: number) {
        if (!this.history.has(id)) this.history.set(id, []);
        const h = this.history.get(id)!;
        h.push(raw);
        if (h.length > this.medianSize) h.shift();

        // Get median
        const sortedX = [...h].map(p => p.x).sort((a, b) => a - b);
        const sortedY = [...h].map(p => p.y).sort((a, b) => a - b);
        const median = {
            x: sortedX[Math.floor(sortedX.length / 2)],
            y: sortedY[Math.floor(sortedY.length / 2)]
        };

        // Adaptive Alpha based on reliability
        const baseAlpha = 0.15;
        const alpha = baseAlpha + (reliability * (1.0 - baseAlpha));
        const last = this.lastFiltered.get(id) || median;

        let filteredX = last.x * (1 - alpha) + median.x * alpha;
        let filteredY = last.y * (1 - alpha) + median.y * alpha;

        // Dead-zone to kill jitter at rest
        if (Math.abs(filteredX - last.x) < this.deadZone) filteredX = last.x;
        if (Math.abs(filteredY - last.y) < this.deadZone) filteredY = last.y;

        const result = { x: filteredX, y: filteredY };
        this.lastFiltered.set(id, result);
        return result;
    }

    reset(id?: number) {
        if (id !== undefined) {
            this.history.delete(id);
            this.lastFiltered.delete(id);
        } else {
            this.history.clear();
            this.lastFiltered.clear();
        }
    }
}

class SimpleAR {
    container: HTMLElement;
    targetSrc: string | string[];
    overlay: HTMLElement;
    scaleMultiplier: number;
    onFound: ((data: { targetIndex: number }) => void | Promise<void>) | null;
    onLost: ((data: { targetIndex: number }) => void | Promise<void>) | null;
    onUpdateCallback: ((data: {
        targetIndex: number,
        worldMatrix: number[],
        screenCoords?: { x: number, y: number }[],
        reliabilities?: number[],
        stabilities?: number[],
        detectionPoints?: { x: number, y: number }[]
    }) => void) | null;
    cameraConfig: MediaStreamConstraints['video'];
    debug: boolean;

    private video: HTMLVideoElement | null = null;
    private controller: BioInspiredController | null = null;
    private smoother = new SmoothingManager();
    private isTracking: boolean = false;
    private markerDimensions: number[][] = [];
    private debugPanel: HTMLElement | null = null;
    private debugCanvas: HTMLCanvasElement | null = null;
    private debugCtx: CanvasRenderingContext2D | null = null;

    private lastTime = 0;
    private fps = 0;
    private frameCount = 0;

    constructor({
        container,
        targetSrc,
        overlay,
        scale = 1.0,
        onFound = null,
        onLost = null,
        onUpdate = null,
        cameraConfig = { facingMode: 'environment', width: 1280, height: 720 },
        debug = false,
    }: SimpleAROptions) {
        this.container = container;
        this.targetSrc = targetSrc;
        this.overlay = overlay;
        this.scaleMultiplier = scale;
        this.onFound = onFound;
        this.onLost = onLost;
        this.onUpdateCallback = onUpdate;
        this.cameraConfig = cameraConfig;
        this.debug = debug;
    }

    async start() {
        this._createVideo();
        await this._startCamera();
        this._initController();

        if (this.debug) {
            this._createDebugPanel();
            this._createDebugCanvas();
        }

        const targets = Array.isArray(this.targetSrc) ? this.targetSrc : [this.targetSrc];
        const result = await this.controller!.addImageTargets(targets);
        this.markerDimensions = result.dimensions;

        // Kick off loop
        this.controller!.processVideo(this.video!);
        return this;
    }

    stop() {
        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }
        if (this.video && this.video.srcObject) {
            (this.video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            this.video.remove();
            this.video = null;
        }
        this.isTracking = false;
        this.smoother.reset();
    }

    private _createVideo() {
        this.video = document.createElement('video');
        this.video.setAttribute('autoplay', '');
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('muted', '');
        this.video.style.cssText = `
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          object-fit: cover; z-index: 0;
        `;
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.insertBefore(this.video, this.container.firstChild);
    }

    private async _startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: this.cameraConfig });
        this.video!.srcObject = stream;
        await this.video!.play();

        await new Promise<void>(resolve => {
            if (this.video!.videoWidth > 0) return resolve();
            this.video!.onloadedmetadata = () => resolve();
        });
    }

    private _initController() {
        this.controller = new BioInspiredController({
            inputWidth: this.video!.videoWidth,
            inputHeight: this.video!.videoHeight,
            debugMode: this.debug,
            bioInspired: {
                enabled: true,
                aggressiveSkipping: false
            },
            onUpdate: (data) => this._handleUpdate(data)
        });
    }

    private _handleUpdate(data: any) {
        if (data.type !== 'updateMatrix') {
            if (data.type === 'featurePoints' && this.debugCtx) {
                this._drawDebugFeatures(data.featurePoints);
            }
            return;
        }

        // FPS Meter
        const now = performance.now();
        this.frameCount++;
        if (now - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            this.frameCount = 0;
            this.lastTime = now;
        }

        const { targetIndex, worldMatrix, modelViewTransform, reliabilities, stabilities, screenCoords, pixelsSaved } = data;

        // Apply Smoothing
        let smoothedCoords = screenCoords || [];
        if (screenCoords && screenCoords.length > 0) {
            smoothedCoords = screenCoords.map((p: any) => {
                const rel = reliabilities ? (reliabilities[p.id] || 0.5) : 0.5;
                const sm = this.smoother.smooth(p.id, p, rel);
                return { ...sm, id: p.id };
            });
        }

        if (worldMatrix) {
            if (!this.isTracking) {
                this.isTracking = true;
                if (this.overlay) this.overlay.style.opacity = '1';
                this.onFound && this.onFound({ targetIndex });
            }
            this._positionOverlay(modelViewTransform, targetIndex);
        } else {
            if (this.isTracking) {
                this.isTracking = false;
                if (this.overlay) this.overlay.style.opacity = '0';
                this.onLost && this.onLost({ targetIndex });
                this.smoother.reset();
            }
        }

        // Notify callback
        if (this.onUpdateCallback) {
            this.onUpdateCallback({
                targetIndex,
                worldMatrix,
                screenCoords: smoothedCoords,
                reliabilities: reliabilities || [],
                stabilities: stabilities || [],
                detectionPoints: data.featurePoints
            });
        }

        // Draw Debug UI
        if (this.debug) {
            this._updateHUD(data);
            this._drawDebugPoints(smoothedCoords, stabilities);
        }
    }

    private _positionOverlay(mVT: number[][], targetIndex: number) {
        if (!this.overlay || !this.markerDimensions[targetIndex]) return;

        const [markerW, markerH] = this.markerDimensions[targetIndex];
        const containerRect = this.container.getBoundingClientRect();
        const videoW = this.video!.videoWidth;
        const videoH = this.video!.videoHeight;
        const proj = this.controller!.projectionTransform;

        // Handle portrait rotation for mobile
        const isPortrait = containerRect.height > containerRect.width;
        const isVideoLandscape = videoW > videoH;
        const needsRotation = isPortrait && isVideoLandscape;

        const pUL = projectToScreen(0, 0, 0, mVT, proj, videoW, videoH, containerRect, needsRotation);
        const pUR = projectToScreen(markerW, 0, 0, mVT, proj, videoW, videoH, containerRect, needsRotation);
        const pLL = projectToScreen(0, markerH, 0, mVT, proj, videoW, videoH, containerRect, needsRotation);
        const pLR = projectToScreen(markerW, markerH, 0, mVT, proj, videoW, videoH, containerRect, needsRotation);

        const matrix = this._solveHomography(markerW, markerH, pUL, pUR, pLL, pLR);

        this.overlay.style.maxWidth = 'none';
        this.overlay.style.width = `${markerW}px`;
        this.overlay.style.height = `${markerH}px`;
        this.overlay.style.position = 'absolute';
        this.overlay.style.transformOrigin = '0 0';
        this.overlay.style.left = '0';
        this.overlay.style.top = '0';
        this.overlay.style.display = 'block';

        this.overlay.style.transform = `
            matrix3d(${matrix.join(',')})
            translate(${markerW / 2}px, ${markerH / 2}px)
            scale(${this.scaleMultiplier})
            translate(${-markerW / 2}px, ${-markerH / 2}px)
        `;
    }

    private _solveHomography(w: number, h: number, p1: any, p2: any, p3: any, p4: any) {
        const x1 = p1.sx, y1 = p1.sy;
        const x2 = p2.sx, y2 = p2.sy;
        const x3 = p3.sx, y3 = p3.sy;
        const x4 = p4.sx, y4 = p4.sy;

        const dx1 = x2 - x4, dx2 = x3 - x4, dx3 = x1 - x2 + x4 - x3;
        const dy1 = y2 - y4, dy2 = y3 - y4, dy3 = y1 - y2 + y4 - y3;

        const det = dx1 * dy2 - dx2 * dy1;
        const g = (dx3 * dy2 - dx2 * dy3) / det;
        const h_coeff = (dx1 * dy3 - dx3 * dy1) / det;
        const a = x2 - x1 + g * x2;
        const b = x3 - x1 + h_coeff * x3;
        const c = x1;
        const d = y2 - y1 + g * y2;
        const e = y3 - y1 + h_coeff * y3;
        const f = y1;

        return [
            a / w, d / w, 0, g / w,
            b / h, e / h, 0, h_coeff / h,
            0, 0, 1, 0,
            c, f, 0, 1
        ];
    }

    // --- DEBUG METHODS ---

    private _createDebugPanel() {
        this.debugPanel = document.createElement('div');
        this.debugPanel.style.cssText = `
            position: absolute; top: 10px; left: 10px;
            background: rgba(0, 0, 0, 0.7); color: #0f0;
            font-family: monospace; font-size: 11px; padding: 10px;
            border-radius: 5px; z-index: 100; pointer-events: none;
            line-height: 1.4; border-left: 3px solid #0f0;
        `;
        this.container.appendChild(this.debugPanel);
    }

    private _createDebugCanvas() {
        this.debugCanvas = document.createElement('canvas');
        this.debugCanvas.width = this.container.clientWidth;
        this.debugCanvas.height = this.container.clientHeight;
        this.debugCanvas.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; z-index: 99;
        `;
        this.container.appendChild(this.debugCanvas);
        this.debugCtx = this.debugCanvas.getContext('2d');
    }

    private _updateHUD(data: any) {
        if (!this.debugPanel) return;
        const rel = data.reliabilities ? (data.reliabilities.reduce((a: any, b: any) => a + b, 0) / data.reliabilities.length).toFixed(2) : "0.00";
        const stab = data.stabilities ? (data.stabilities.reduce((a: any, b: any) => a + b, 0) / data.stabilities.length).toFixed(2) : "0.00";
        const savings = data.pixelsSaved ? ((data.pixelsSaved / (this.video!.videoWidth * this.video!.videoHeight)) * 100).toFixed(0) : "0";

        this.debugPanel.innerHTML = `
            <b>TapTapp AR HUD</b><br>
            ------------------<br>
            STATUS:   <span style="color:${this.isTracking ? '#0f0' : '#f00'}">${this.isTracking ? 'TRACKING' : 'SEARCHING'}</span><br>
            FPS:      ${this.fps}<br>
            RELIAB:   ${rel}<br>
            STABIL:   ${stab}<br>
            SAVINGS:  ${savings}% Pixels<br>
            POINTS:   ${data.screenCoords?.length || 0}
        `;
    }

    private _drawDebugPoints(coords: any[], stabilities: any[]) {
        if (!this.debugCtx) return;
        this.debugCtx.clearRect(0, 0, this.debugCanvas!.width, this.debugCanvas!.height);

        coords.forEach((p, i) => {
            const s = stabilities ? (stabilities[i] || 0) : 0.5;
            this.debugCtx!.fillStyle = `rgba(0, 255, 0, ${0.4 + s * 0.6})`;
            this.debugCtx!.fillRect(p.x - 1, p.y - 1, 2, 2);
        });
    }

    private _drawDebugFeatures(points: any[]) {
        if (!this.debugCtx || this.isTracking) return;
        this.debugCtx.clearRect(0, 0, this.debugCanvas!.width, this.debugCanvas!.height);
        this.debugCtx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        points.slice(0, 200).forEach(p => {
            this.debugCtx!.fillRect(p.x - 1, p.y - 1, 2, 2);
        });
    }
}

export { SimpleAR };
