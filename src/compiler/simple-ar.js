import { Controller } from "./controller.js";
import { OneEuroFilter } from "../libs/one-euro-filter.js";
import { projectToScreen } from "./utils/projection.js";

/**
 * 🍦 SimpleAR - Dead-simple vanilla AR for image overlays
 * 
 * No Three.js. No A-Frame. Just HTML, CSS, and JavaScript.
 * 
 * @example
 * const ar = new SimpleAR({
 *   container: document.getElementById('ar-container'),
 *   targetSrc: './my-target.mind',
 *   overlay: document.getElementById('my-overlay'),
 *   onFound: () => console.log('Target found!'),
 *   onLost: () => console.log('Target lost!')
 * });
 * 
 * await ar.start();
 */
class SimpleAR {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {string|string[]} options.targetSrc
     * @param {HTMLElement} options.overlay
     * @param {number} [options.scale=1.0]
     * @param {((data: {targetIndex: number}) => void | Promise<void>) | null} [options.onFound]
     * @param {((data: {targetIndex: number}) => void | Promise<void>) | null} [options.onLost]
     * @param {((data: {targetIndex: number, worldMatrix: number[]}) => void) | null} [options.onUpdate]
     * @param {Object} [options.cameraConfig]
     */
    constructor({
        container,
        targetSrc,
        overlay,
        scale = 1.0, // Multiplicador de escala personalizado
        onFound = null,
        onLost = null,
        onUpdate = null,
        cameraConfig = { facingMode: 'environment', width: 1280, height: 720 },
        debug = false,
    }) {
        this.container = container;
        this.targetSrc = targetSrc;
        this.overlay = overlay;
        this.scaleMultiplier = scale;
        this.onFound = onFound;
        this.onLost = onLost;
        this.onUpdateCallback = onUpdate;
        this.cameraConfig = cameraConfig;
        this.debug = debug;
        if (this.debug) window.AR_DEBUG = true;

        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.debugPanel = null;

        this.video = null;
        this.controller = null;
        this.isTracking = false;
        this.lastMatrix = null;
        this.filters = []; // One filter per target
    }

    /**
   * Initialize and start AR tracking
   */
    async start() {
        // 1. Create video element
        this._createVideo();

        // 2. Start camera
        await this._startCamera();

        // 3. Initialize controller
        this._initController();

        if (this.debug) this._createDebugPanel();

        // 4. Load targets (supports single URL or array of URLs)
        const targets = Array.isArray(this.targetSrc) ? this.targetSrc : [this.targetSrc];
        const result = await this.controller.addImageTargets(targets);
        this.markerDimensions = result.dimensions; // [ [w1, h1], [w2, h2], ... ]
        console.log("Targets loaded. Dimensions:", this.markerDimensions);

        this.controller.processVideo(this.video);

        return this;
    }

    /**
     * Stop AR tracking and release resources
     */
    stop() {
        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.remove();
            this.video = null;
        }
        this.isTracking = false;
        this.markerDimensions = [];
    }

    _createVideo() {
        this.video = document.createElement('video');
        this.video.setAttribute('autoplay', '');
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('muted', '');
        this.video.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
    `;
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.insertBefore(this.video, this.container.firstChild);
    }

    async _startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: this.cameraConfig
        });
        this.video.srcObject = stream;
        await this.video.play();

        // Wait for video dimensions to be available
        await new Promise(resolve => {
            if (this.video.videoWidth > 0) return resolve();
            this.video.onloadedmetadata = resolve;
        });
    }

    _initController() {
        this.controller = new Controller({
            inputWidth: this.video.videoWidth,
            inputHeight: this.video.videoHeight,
            debugMode: this.debug,
            onUpdate: (data) => this._handleUpdate(data)
        });
    }

    _handleUpdate(data) {
        if (data.type !== 'updateMatrix') return;

        // FPS Calculation
        const now = performance.now();
        this.frameCount++;
        if (now - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            this.frameCount = 0;
            this.lastTime = now;
            if (this.debug) this._updateDebugPanel(this.isTracking);
        }

        const { targetIndex, worldMatrix, modelViewTransform } = data;

        if (worldMatrix) {
            // Target found
            if (!this.isTracking) {
                this.isTracking = true;
                this.overlay && (this.overlay.style.opacity = '1');
                this.onFound && this.onFound({ targetIndex });
            }

            this.lastMatrix = worldMatrix;

            // Smooth the tracking data if filters are initialized
            if (!this.filters[targetIndex]) {
                this.filters[targetIndex] = new OneEuroFilter({ minCutOff: 0.1, beta: 0.01 });
            }

            // Flatten modelViewTransform for filtering (3x4 matrix = 12 values)
            const flatMVT = [
                modelViewTransform[0][0], modelViewTransform[0][1], modelViewTransform[0][2], modelViewTransform[0][3],
                modelViewTransform[1][0], modelViewTransform[1][1], modelViewTransform[1][2], modelViewTransform[1][3],
                modelViewTransform[2][0], modelViewTransform[2][1], modelViewTransform[2][2], modelViewTransform[2][3]
            ];
            const smoothedFlat = this.filters[targetIndex].filter(Date.now(), flatMVT);
            const smoothedMVT = [
                [smoothedFlat[0], smoothedFlat[1], smoothedFlat[2], smoothedFlat[3]],
                [smoothedFlat[4], smoothedFlat[5], smoothedFlat[6], smoothedFlat[7]],
                [smoothedFlat[8], smoothedFlat[9], smoothedFlat[10], smoothedFlat[11]]
            ];

            this._positionOverlay(smoothedMVT, targetIndex);
            this.onUpdateCallback && this.onUpdateCallback({ targetIndex, worldMatrix });

        } else {
            // Target lost
            if (this.isTracking) {
                this.isTracking = false;
                if (this.filters[targetIndex]) this.filters[targetIndex].reset();
                this.overlay && (this.overlay.style.opacity = '0');
                this.onLost && this.onLost({ targetIndex });
            }
        }
    }

    _positionOverlay(mVT, targetIndex) {
        if (!this.overlay || !this.markerDimensions[targetIndex]) return;

        const [markerW, markerH] = this.markerDimensions[targetIndex];
        const containerRect = this.container.getBoundingClientRect();
        const videoW = this.video.videoWidth;
        const videoH = this.video.videoHeight;

        // 1. Determine orientation needs
        const isPortrait = containerRect.height > containerRect.width;
        const isVideoLandscape = videoW > videoH;
        const needsRotation = isPortrait && isVideoLandscape;

        // 3. Get intrinsic projection from controller
        const proj = this.controller.projectionTransform;

        // 3. Project 4 corners to determine a full 3D perspective (homography)
        const pUL = projectToScreen(0, 0, 0, mVT, proj, videoW, videoH, containerRect, needsRotation);
        const pUR = projectToScreen(markerW, 0, 0, mVT, proj, videoW, videoH, containerRect, needsRotation);
        const pLL = projectToScreen(0, markerH, 0, mVT, proj, videoW, videoH, containerRect, needsRotation);
        const pLR = projectToScreen(markerW, markerH, 0, mVT, proj, videoW, videoH, containerRect, needsRotation);

        // Helper to solve for 2D Homography (maps 0..1 square to pUL, pUR, pLL, pLR)
        const solveHomography = (w, h, p1, p2, p3, p4) => {
            const x1 = p1.sx, y1 = p1.sy;
            const x2 = p2.sx, y2 = p2.sy;
            const x3 = p3.sx, y3 = p3.sy;
            const x4 = p4.sx, y4 = p4.sy;

            const dx1 = x2 - x4, dx2 = x3 - x4, dx3 = x1 - x2 + x4 - x3;
            const dy1 = y2 - y4, dy2 = y3 - y4, dy3 = y1 - y2 + y4 - y3;

            let a, b, c, d, e, f, g, h_coeff;

            if (dx3 === 0 && dy3 === 0) {
                a = x2 - x1; b = x3 - x1; c = x1;
                d = y2 - y1; e = y3 - y1; f = y1;
                g = 0; h_coeff = 0;
            } else {
                const det = dx1 * dy2 - dx2 * dy1;
                g = (dx3 * dy2 - dx2 * dy3) / det;
                h_coeff = (dx1 * dy3 - dx3 * dy1) / det;
                a = x2 - x1 + g * x2;
                b = x3 - x1 + h_coeff * x3;
                c = x1;
                d = y2 - y1 + g * y2;
                e = y3 - y1 + h_coeff * y3;
                f = y1;
            }
            // This maps unit square (0..1) to the quadrilateral.
            // We need to scale it by 1/w and 1/h to map (0..w, 0..h)
            return [
                a / w, d / w, 0, g / w,
                b / h, e / h, 0, h_coeff / h,
                0, 0, 1, 0,
                c, f, 0, 1
            ];
        };

        const matrix = solveHomography(markerW, markerH, pUL, pUR, pLL, pLR);

        // Apply styles
        this.overlay.style.maxWidth = 'none';
        this.overlay.style.width = `${markerW}px`;
        this.overlay.style.height = `${markerH}px`;
        this.overlay.style.position = 'absolute';
        this.overlay.style.transformOrigin = '0 0';
        this.overlay.style.left = '0';
        this.overlay.style.top = '0';
        this.overlay.style.display = 'block';

        // Apply 3D transform with matrix3d
        // We also apply the user's custom scaleMultiplier AFTER the perspective transform
        // but since we want to scale around the marker center, we apply it as a prefix/suffix
        // Scale around top-left (0,0) is easy. Scale around center requires offset.
        this.overlay.style.transform = `
            matrix3d(${matrix.join(',')})
            translate(${markerW / 2}px, ${markerH / 2}px)
            scale(${this.scaleMultiplier})
            translate(${-markerW / 2}px, ${-markerH / 2}px)
        `;
    }

    // Unified projection logic moved to ./utils/projection.js

    _createDebugPanel() {
        this.debugPanel = document.createElement('div');
        this.debugPanel.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #0f0;
            font-family: monospace;
            font-size: 12px;
            padding: 8px;
            border-radius: 4px;
            z-index: 99999;
            pointer-events: none;
            line-height: 1.5;
        `;
        this.container.appendChild(this.debugPanel);
    }

    _updateDebugPanel(isTracking) {
        if (!this.debugPanel) return;
        const memory = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : '?';
        const color = isTracking ? '#0f0' : '#f00';
        const status = isTracking ? 'TRACKING' : 'SEARCHING';

        this.debugPanel.innerHTML = `
            <div>HEAD-UP DISPLAY</div>
            <div>----------------</div>
            <div>FPS:    ${this.fps}</div>
            <div>STATUS: <span style="color:${color}">${status}</span></div>
            <div>MEM:    ${memory} MB</div>
        `;
    }
}

export { SimpleAR };
