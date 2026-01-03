/**
 * @fileoverview Compilador Offline Optimizado - Sin TensorFlow para máxima velocidad
 * 
 * Este módulo implementa un compilador de imágenes AR ultrarrápido
 * que NO depende de TensorFlow, eliminando todos los problemas de
 * inicialización, bloqueos y compatibilidad.
 * 
 * Usa JavaScript puro para:
 * - Extracción de features de tracking (extract.js)
 * - Detección de features para matching (DetectorLite)
 * - Clustering jerárquico para features
 * 
 * Funciona en:
 * - Node.js (con workers opcionales)
 * - Browser (sin workers)
 */

import { buildTrackingImageList, buildImageList } from "./image-list.js";
import { extractTrackingFeatures } from "./tracker/extract-utils.js";
import { DetectorLite } from "./detector/detector-lite.js";
import { build as hierarchicalClusteringBuild } from "./matching/hierarchical-clustering.js";
import * as msgpack from "@msgpack/msgpack";
import { WorkerPool } from "./utils/worker-pool.js";

// Detect environment
const isNode = typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

const CURRENT_VERSION = 3; // Protocol v3: High-performance Columnar Binary Format

/**
 * Compilador offline optimizado sin TensorFlow
 */
export class OfflineCompiler {
  constructor() {
    this.data = null;
    this.workerPool = null;

    // Workers solo en Node.js (no en browser)
    if (isNode) {
      this._initNodeWorkers();
    } else {
      console.log("🌐 OfflineCompiler: Browser mode (no workers)");
    }
  }

  async _initNodeWorkers() {
    try {
      // Use variables to prevent bundlers from trying to bundle these
      const pathModule = "path";
      const urlModule = "url";
      const osModule = "os";
      const workerThreadsModule = "node:worker_threads";

      const [path, url, os, { Worker }] = await Promise.all([
        import(pathModule),
        import(urlModule),
        import(osModule),
        import(workerThreadsModule)
      ]);

      const __filename = url.fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const workerPath = path.join(__dirname, "node-worker.js");

      // Limit workers to avoid freezing system
      const numWorkers = Math.min(os.cpus().length, 4);

      this.workerPool = new WorkerPool(workerPath, numWorkers, Worker);
      console.log(`🚀 OfflineCompiler: Node.js mode with ${numWorkers} workers`);
    } catch (e) {
      console.log("⚡ OfflineCompiler: Running without workers (initialization failed)", e);
    }
  }

  /**
   * Compila una lista de imágenes objetivo
   * @param {Array} images - Lista de imágenes {width, height, data}
   * @param {Function} progressCallback - Callback de progreso (0-100)
   * @returns {Promise<Array>} Datos compilados
   */
  async compileImageTargets(images, progressCallback) {
    console.time("⏱️ Compilación total");

    const targetImages = [];

    // Preparar imágenes
    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      if (!img || !img.width || !img.height || !img.data) {
        throw new Error(
          `Imagen inválida en posición ${i}. Debe tener propiedades width, height y data.`
        );
      }

      // Convertir a escala de grises
      const greyImageData = new Uint8Array(img.width * img.height);

      if (img.data.length === img.width * img.height) {
        greyImageData.set(img.data);
      } else if (img.data.length === img.width * img.height * 4) {
        for (let j = 0; j < greyImageData.length; j++) {
          const offset = j * 4;
          greyImageData[j] = Math.floor(
            (img.data[offset] + img.data[offset + 1] + img.data[offset + 2]) / 3
          );
        }
      } else {
        throw new Error(`Formato de datos de imagen no soportado en posición ${i}`);
      }

      targetImages.push({
        data: greyImageData,
        width: img.width,
        height: img.height,
      });
    }

    // Compilar Match y Track por separado
    const matchingDataList = await this._compileMatch(targetImages, (p) => {
      progressCallback(p * 0.7); // 70% Match
    });

    const trackingDataList = await this._compileTrack(targetImages, (p) => {
      progressCallback(70 + p * 0.3); // 30% Track
    });

    this.data = targetImages.map((img, i) => ({
      targetImage: img,
      matchingData: matchingDataList[i],
      trackingData: trackingDataList[i],
    }));

    console.timeEnd("⏱️ Compilación total");
    return this.data;
  }

  async _compileMatch(targetImages, progressCallback) {
    const percentPerImage = 100 / targetImages.length;
    let currentPercent = 0;

    // Use workers if available
    if (this.workerPool) {
      const progressMap = new Float32Array(targetImages.length);

      const wrappedPromises = targetImages.map((targetImage, index) => {
        return this.workerPool.runTask({
          type: 'match',
          targetImage,
          percentPerImage,
          basePercent: 0,
          onProgress: (p) => {
            progressMap[index] = p;
            const sum = progressMap.reduce((a, b) => a + b, 0);
            progressCallback(sum);
          }
        });
      });

      return Promise.all(wrappedPromises);
    }

    // Serial Fallback
    const results = [];
    for (let i = 0; i < targetImages.length; i++) {
      const targetImage = targetImages[i];
      const imageList = buildImageList(targetImage);
      const percentPerScale = percentPerImage / imageList.length;

      const keyframes = [];

      for (const image of imageList) {
        const detector = new DetectorLite(image.width, image.height);
        const { featurePoints: ps } = detector.detect(image.data);

        const maximaPoints = ps.filter((p) => p.maxima);
        const minimaPoints = ps.filter((p) => !p.maxima);
        const maximaPointsCluster = hierarchicalClusteringBuild({ points: maximaPoints });
        const minimaPointsCluster = hierarchicalClusteringBuild({ points: minimaPoints });

        keyframes.push({
          maximaPoints,
          minimaPoints,
          maximaPointsCluster,
          minimaPointsCluster,
          width: image.width,
          height: image.height,
          scale: image.scale,
        });

        currentPercent += percentPerScale;
        progressCallback(currentPercent);
      }

      results.push(keyframes);
    }

    return results;
  }

  async _compileTrack(targetImages, progressCallback) {
    const percentPerImage = 100 / targetImages.length;
    let currentPercent = 0;

    if (this.workerPool) {
      const progressMap = new Float32Array(targetImages.length);
      const wrappedPromises = targetImages.map((targetImage, index) => {
        return this.workerPool.runTask({
          type: 'compile',
          targetImage,
          percentPerImage,
          basePercent: 0,
          onProgress: (p) => {
            progressMap[index] = p;
            const sum = progressMap.reduce((a, b) => a + b, 0);
            progressCallback(sum);
          }
        });
      });
      return Promise.all(wrappedPromises);
    }

    // Serial Fallback
    const results = [];
    for (let i = 0; i < targetImages.length; i++) {
      const targetImage = targetImages[i];
      const imageList = buildTrackingImageList(targetImage);
      const percentPerScale = percentPerImage / imageList.length;

      const trackingData = extractTrackingFeatures(imageList, () => {
        currentPercent += percentPerScale;
        progressCallback(currentPercent);
      });

      results.push(trackingData);
    }

    return results;
  }

  async compileTrack({ progressCallback, targetImages, basePercent = 0 }) {
    return this._compileTrack(targetImages, (percent) => {
      progressCallback(basePercent + percent * (100 - basePercent) / 100);
    });
  }

  async compileMatch({ progressCallback, targetImages, basePercent = 0 }) {
    return this._compileMatch(targetImages, (percent) => {
      progressCallback(basePercent + percent * (50 - basePercent) / 100);
    });
  }

  exportData() {
    if (!this.data) {
      throw new Error("No hay datos compilados para exportar");
    }

    const dataList = this.data.map((item) => {
      const matchingData = item.matchingData.map((kf) => this._packKeyframe(kf));

      const trackingData = item.trackingData.map((td) => {
        const count = td.points.length;
        const px = new Float32Array(count);
        const py = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          px[i] = td.points[i].x;
          py[i] = td.points[i].y;
        }
        return {
          w: td.width,
          h: td.height,
          s: td.scale,
          px,
          py,
          d: td.data, // Grayscale pixel data (Uint8Array)
        };
      });

      return {
        targetImage: {
          width: item.targetImage.width,
          height: item.targetImage.height,
        },
        trackingData,
        matchingData,
      };
    });

    return msgpack.encode({
      v: CURRENT_VERSION,
      dataList,
    });
  }

  _packKeyframe(kf) {
    return {
      w: kf.width,
      h: kf.height,
      s: kf.scale,
      max: this._columnarize(kf.maximaPoints, kf.maximaPointsCluster),
      min: this._columnarize(kf.minimaPoints, kf.minimaPointsCluster),
    };
  }

  _columnarize(points, tree) {
    const count = points.length;
    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const angle = new Float32Array(count);
    const scale = new Float32Array(count);
    const descriptors = new Uint8Array(count * 84); // 84 bytes per point (FREAK)

    for (let i = 0; i < count; i++) {
      x[i] = points[i].x;
      y[i] = points[i].y;
      angle[i] = points[i].angle;
      scale[i] = points[i].scale;
      descriptors.set(points[i].descriptors, i * 84);
    }

    return {
      x,
      y,
      a: angle,
      s: scale,
      d: descriptors,
      t: this._compactTree(tree.rootNode),
    };
  }

  _compactTree(node) {
    if (node.leaf) {
      return [1, node.centerPointIndex || 0, node.pointIndexes];
    }
    return [0, node.centerPointIndex || 0, node.children.map((c) => this._compactTree(c))];
  }

  importData(buffer) {
    const content = msgpack.decode(new Uint8Array(buffer));

    if (!content.v || content.v !== CURRENT_VERSION) {
      console.error("Incompatible .mind version. Required: " + CURRENT_VERSION);
      return [];
    }

    // Restore Float32Arrays from Uint8Arrays returned by msgpack
    const dataList = content.dataList;
    for (let i = 0; i < dataList.length; i++) {
      const item = dataList[i];
      for (const kf of item.matchingData) {
        for (const col of [kf.max, kf.min]) {
          if (col.x instanceof Uint8Array) {
            col.x = new Float32Array(col.x.buffer.slice(col.x.byteOffset, col.x.byteOffset + col.x.byteLength));
          }
          if (col.y instanceof Uint8Array) {
            col.y = new Float32Array(col.y.buffer.slice(col.y.byteOffset, col.y.byteOffset + col.y.byteLength));
          }
          if (col.a instanceof Uint8Array) {
            col.a = new Float32Array(col.a.buffer.slice(col.a.byteOffset, col.a.byteOffset + col.a.byteLength));
          }
          if (col.s instanceof Uint8Array) {
            col.s = new Float32Array(col.s.buffer.slice(col.s.byteOffset, col.s.byteOffset + col.s.byteLength));
          }
        }
      }
    }

    this.data = dataList;
    return this.data;
  }

  _unpackKeyframe(kf) {
    return {
      width: kf.w,
      height: kf.h,
      scale: kf.s,
      maximaPoints: this._decolumnarize(kf.max),
      minimaPoints: this._decolumnarize(kf.min),
      maximaPointsCluster: { rootNode: this._expandTree(kf.max.t) },
      minimaPointsCluster: { rootNode: this._expandTree(kf.min.t) },
    };
  }

  _decolumnarize(col) {
    const points = [];
    const count = col.x.length;
    for (let i = 0; i < count; i++) {
      points.push({
        x: col.x[i],
        y: col.y[i],
        angle: col.a[i],
        scale: col.s ? col.s[i] : 1.0,
        descriptors: col.d.slice(i * 84, (i + 1) * 84),
      });
    }
    return points;
  }

  _expandTree(node) {
    const isLeaf = node[0] === 1;
    if (isLeaf) {
      return {
        leaf: true,
        centerPointIndex: node[1],
        pointIndexes: node[2],
      };
    }
    return {
      leaf: false,
      centerPointIndex: node[1],
      children: node[2].map((c) => this._expandTree(c)),
    };
  }

  async destroy() {
    if (this.workerPool) {
      await this.workerPool.destroy();
    }
  }
}
