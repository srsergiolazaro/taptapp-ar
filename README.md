# @srsergio/taptapp-ar

🚀 **TapTapp AR** is a high-performance Augmented Reality (AR) compiler toolkit for **Node.js** and **Browser** environments. It provides an ultra-fast offline compiler for image targets.

Built with performance in mind, this package features a **pure JavaScript offline compiler** that requires **no TensorFlow** for compilation, generating high-quality `.mind` files in record time.

---

## 🌟 Key Features

- 🖼️ **Ultra-Fast Offline Compiler**: Pure JavaScript compiler that generates `.mind` target files in **~1.3s per image**.
- ⚡ **Zero TensorFlow for Compilation**: The offline compiler uses optimized pure JS algorithms - no TensorFlow installation required.
- 🧵 **Multi-threaded Engine**: Truly parallel processing using Node.js `worker_threads` for bulk image compilation.
- 🚀 **Serverless Ready**: Lightweight compiler with minimal dependencies, perfect for Vercel, AWS Lambda, and Netlify.
- 📦 **Protocol V3 (Columnar Binary)**: Industry-leading performance with zero-copy loading and 80%+ smaller files.

---

## 🛠 Installation

```bash
npm install @srsergio/taptapp-ar
```

### 📦 Optional Dependencies

> **Note:** TensorFlow is **NOT required** for the offline compiler. It only uses pure JavaScript.

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
import { OfflineCompiler } from '@srsergio/taptapp-ar';

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
import { OfflineCompiler } from '@srsergio/taptapp-ar';

const compiler = new OfflineCompiler();
// Loading 127KB instead of 800KB saves bandwidth and CPU parsing time
compiler.importData(binaryBuffer); 
```

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
