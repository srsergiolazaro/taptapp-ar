# @srsergio/taptapp-ar

🚀 **TapTapp AR** is a high-performance Augmented Reality (AR) toolkit specifically designed for **Astro** and **Node.js** environments. It provides a seamless way to integrate image tracking, video overlays, and an offline compiler for image targets.

Built on top of **MindAR** and **A-Frame**, this package features a **pure JavaScript offline compiler** that requires **no TensorFlow** for backend compilation, while still supporting TensorFlow.js for real-time tracking in the browser.

---

## 🌟 Key Features

- 🚀 **Astro Native**: Optimized components for Astro's Islands architecture.
- 🖼️ **Ultra-Fast Offline Compiler**: Pure JavaScript compiler that generates `.mind` target files in **~1.3s per image**.
- ⚡ **Zero TensorFlow for Compilation**: The offline compiler uses optimized pure JS algorithms - no TensorFlow installation required.
- 🧵 **Multi-threaded Engine**: Truly parallel processing using Node.js `worker_threads` for bulk image compilation.
- 🚀 **Serverless Ready**: Lightweight compiler with minimal dependencies, perfect for Vercel, AWS Lambda, and Netlify.

---

## 🛠 Installation

```bash
npm install @srsergio/taptapp-ar
```

### 📦 Optional Dependencies

> **Note:** TensorFlow is **NOT required** for the offline compiler. It only uses pure JavaScript.

For real-time AR tracking in the browser, TensorFlow.js is loaded automatically via CDN.

---

## 🚀 Astro Integration Guide

The easiest way to display AR content is using the `ARVideoTrigger` component.

### Usage

```astro
---
import ARVideoTrigger from '@srsergio/taptapp-ar/astro/ARVideoTrigger.astro';

const config = {
  cardId: 'unique-id',
  targetImageSrc: 'https://cdn.example.com/target.jpg',
  targetMindSrc: 'https://cdn.example.com/targets.mind',
  videoSrc: 'https://cdn.example.com/overlay.mp4',
  videoWidth: 1280,
  videoHeight: 720,
  scale: 1.2,
};
---

<ARVideoTrigger config={config} />
```

---

## 🖼️ High-Performance Compiler (Protocol V3)

TaptApp AR features the industry's most advanced **pure JavaScript** offline compiler. With the introduction of **Protocol V3 (Columnar Binary Format)**, it sets a new standard for AR asset management.

### ⚡ Industry-Leading Benchmarks

| Metric | Official MindAR | TapTapp AR (v3) | Improvement |
| :--- | :--- | :--- | :--- |
| **Compilation Time** | ~23.50s | **~1.71s** | 🚀 **13.7x Faster** |
| **Output Size (.mind)** | ~770 KB | **~127 KB** | 📉 **83.5% Smaller** |
| **Loading Latency** | >100ms | **2.6ms** | ⚡ **Zero-Copy** |
| **Memory Footprint** | Heavy (JSON Objects) | **Minimal (Binary)** | 🧠 **CPU-Aligned** |

> *Tested on 1024x1024 high-detail image target.*

### 🚀 Key Technical Breakthroughs

- **Protocol V3 (Columnar Binary)**: Uses TypedArrays to store coordinates, angles, and descriptors in a cache-aligned layout. No more thousands of slow JavaScript objects.
- **Zero-Copy Loading**: The runtime reads directly from the binary buffer. Initialization is now virtualy instant.
- **Aggressive Matching Optimization**: Tree-based hierarchical clustering compacted into a flattened binary format.
- **No Dependencies**: Works in Node.js and Browser with zero external requirements for the compilation core.

### 🖥️ Usage (Node.js & Serverless)

Optimized for server-side compilation with multi-core parallelism:

```javascript
import { OfflineCompiler } from '@srsergio/taptapp-ar/compiler/offline-compiler.js';

const compiler = new OfflineCompiler();

// Compile target image
const compiledData = await compiler.compileImageTargets(
  [{ width, height, data: grayscaleUint8Array }], 
  (progress) => console.log(`Compiling: ${progress}%`)
);

// Export to Protocol V3 binary format
const binaryBuffer = compiler.exportData(); // Yields a much smaller .mind file
```

### 🌐 Frontend (Zero-Latency Loading)

```javascript
import { OfflineCompiler } from '@srsergio/taptapp-ar/compiler/offline-compiler.js';

const compiler = new OfflineCompiler();
// Loading 127KB instead of 800KB saves bandwidth and CPU parsing time
compiler.importData(binaryBuffer); 
```
---

## ❓ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **Camera not starting** | Ensure your site is served via `HTTPS`. Browsers block camera access on insecure origins. |
| **Video not playing** | iOS Safari requires `muted` and `playsinline` attributes for autoplaying videos. Our components handle this by default. |
| **CORS errors** | Ensure that `targetImageSrc`, `targetMindSrc`, and `videoSrc` have CORS headers enabled (`Access-Control-Allow-Origin: *`). |
| **Memory Outage on Serverless** | Reduce the resolution of your target images. High-res images increase memory pressure during compilation. |

---

## 🏗 Development

```bash
# Install dependencies
npm install

# Build the package
npm run build
```

The package uses **TypeScript** and exports both ESM and CJS compatible builds located in the `dist` folder.

---

## 📄 License

MIT © [srsergiolazaro](https://github.com/srsergiolazaro)
