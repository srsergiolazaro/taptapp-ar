import { DetectorLite } from "./detector-lite.js";

class CropDetector {
  constructor(width, height, debugMode = false) {
    this.debugMode = debugMode;
    this.width = width;
    this.height = height;

    // nearest power of 2, min dimensions
    let minDimension = Math.min(width, height) / 2;
    let cropSize = Math.pow(2, Math.round(Math.log(minDimension) / Math.log(2)));
    this.cropSize = cropSize;

    this.detector = new DetectorLite(cropSize, cropSize, { useLSH: true });

    this.lastRandomIndex = 4;
  }

  detect(input) {
    const imageData = input;

    // crop center
    const startY = Math.floor(this.height / 2 - this.cropSize / 2);
    const startX = Math.floor(this.width / 2 - this.cropSize / 2);
    const result = this._detect(imageData, startX, startY);

    if (this.debugMode) {
      result.debugExtra.crop = { startX, startY, cropSize: this.cropSize };
    }
    return result;
  }

  detectMoving(input) {
    const imageData = input;

    // 🚀 MOONSHOT: High Frequency Global Scan
    // Scan full screen every 2 frames when searching to guarantee instant recovery
    if (this.lastRandomIndex % 2 === 0) {
      this.lastRandomIndex = (this.lastRandomIndex + 1) % 25;
      return this._detectGlobal(imageData);
    }

    // Local crops (25 grid)
    const gridSize = 5;
    const idx = (this.lastRandomIndex - 1) % (gridSize * gridSize);
    // ... rest of logic remains but we hit it less often because global scan is more successful
    const dx = idx % gridSize;
    const dy = Math.floor(idx / gridSize);
    const stepX = this.cropSize / 3;
    const stepY = this.cropSize / 3;

    let startY = Math.floor(this.height / 2 - this.cropSize / 2 + (dy - 2) * stepY);
    let startX = Math.floor(this.width / 2 - this.cropSize / 2 + (dx - 2) * stepX);

    startX = Math.max(0, Math.min(this.width - this.cropSize - 1, startX));
    startY = Math.max(0, Math.min(this.height - this.cropSize - 1, startY));

    this.lastRandomIndex = (this.lastRandomIndex + 1) % 25;
    return this._detect(imageData, startX, startY);
  }

  _detectGlobal(imageData) {
    const croppedData = new Float32Array(this.cropSize * this.cropSize);
    const scaleX = this.width / this.cropSize;
    const scaleY = this.height / this.cropSize;

    // Better sampling: avoid missing edges by jumping too much
    for (let y = 0; y < this.cropSize; y++) {
      const srcY = Math.floor(y * scaleY) * this.width;
      const dstY = y * this.cropSize;
      for (let x = 0; x < this.cropSize; x++) {
        // Average slightly to preserve gradients
        const sx = Math.floor(x * scaleX);
        croppedData[dstY + x] = (imageData[srcY + sx] + imageData[srcY + sx + 1]) * 0.5;
      }
    }

    const { featurePoints } = this.detector.detect(croppedData);
    featurePoints.forEach((p) => {
      p.x *= scaleX;
      p.y *= scaleY;
    });

    return {
      featurePoints,
      debugExtra: this.debugMode ? { projectedImage: Array.from(croppedData), isGlobal: true } : {}
    };
  }

  _detect(imageData, startX, startY) {
    // Crop manually since imageData is now a flat array (width * height)
    const croppedData = new Float32Array(this.cropSize * this.cropSize);
    for (let y = 0; y < this.cropSize; y++) {
      for (let x = 0; x < this.cropSize; x++) {
        croppedData[y * this.cropSize + x] = imageData[(startY + y) * this.width + (startX + x)];
      }
    }

    const { featurePoints } = this.detector.detect(croppedData);

    featurePoints.forEach((p) => {
      p.x += startX;
      p.y += startY;
    });

    return {
      featurePoints,
      debugExtra: this.debugMode ? { projectedImage: Array.from(croppedData) } : {}
    };
  }
}

export { CropDetector };
