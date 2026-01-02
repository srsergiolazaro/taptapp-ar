import * as tf from "@tensorflow/tfjs";

// Registrar backends básicos
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";

// Registrar kernels personalizados
import "./detector/kernels/cpu/index.js";
import "./detector/kernels/webgl/index.js";

/**
 * Configuración optimizada de TensorFlow para diferentes entornos
 * @returns {Promise<string>} El backend activo ('webgl', 'cpu')
 */
export async function setupTensorFlow() {
  console.log("🔧 Iniciando configuración optimizada de TensorFlow.js...");

  try {
    // Optimizaciones base para todos los backends
    tf.ENV.set("DEBUG", false);
    tf.ENV.set("WEBGL_CPU_FORWARD", false);
    tf.ENV.set("WEBGL_FORCE_F16_TEXTURES", true);

    // Configuración adaptativa de memoria según el entorno
    const isServerless = typeof window === "undefined";
    const memoryThreshold = isServerless ? 1024 * 1024 * 4 : 1024 * 1024 * 8; // 4MB en serverless, 8MB en cliente
    tf.ENV.set("CPU_HANDOFF_SIZE_THRESHOLD", memoryThreshold);

    // Configuración específica para entorno serverless
    if (isServerless) {
      try {
        await tf.setBackend("cpu");
        console.log("🚀 Backend CPU optimizado para entorno serverless");

        // Optimizaciones específicas para CPU en serverless
        tf.ENV.set("CPU_HANDOFF_SIZE_THRESHOLD", 1024 * 1024 * 2); // 2MB
        tf.ENV.set("WEBGL_DELETE_TEXTURE_THRESHOLD", 0);

        // Precalentar el backend
        await tf.ready();
        return "cpu";
      } catch (cpuError) {
        console.error("❌ Error crítico en configuración CPU:", cpuError);
        throw new Error("No se pudo inicializar TensorFlow.js en modo serverless");
      }
    }

    // Configuración optimizada para navegador (WebGL)
    try {
      // Optimizaciones avanzadas para WebGL
      tf.ENV.set("WEBGL_PACK", true);
      tf.ENV.set("WEBGL_PACK_DEPTHWISECONV", true);
      tf.ENV.set("WEBGL_MAX_TEXTURE_SIZE", 4096);
      tf.ENV.set("WEBGL_USE_SHAPES_UNIFORMS", true);
      tf.ENV.set("WEBGL_CONV_IM2COL", true);

      await tf.setBackend("webgl");
      console.log("🎮 Backend WebGL activado con optimizaciones avanzadas");

      // Precalentar el backend
      await tf.ready();
      return "webgl";
    } catch (webglError) {
      console.warn(
        `No se pudo activar WebGL: ${webglError.message}, usando CPU como último recurso`,
      );
    }

    // CPU Backend (más lento, último recurso)
    await tf.setBackend("cpu");
    console.log("⚠️ Backend CPU activado (rendimiento sub-óptimo)");

    // Optimizaciones específicas para CPU
    tf.ENV.set("CPU_HANDOFF_SIZE_THRESHOLD", 1024 * 1024 * 2); // 2MB
  } catch (error) {
    console.error("Error crítico configurando backends de TensorFlow:", error);
    throw new Error("No se pudo inicializar TensorFlow.js con ningún backend");
  }

  // Registrar kernels específicos para el backend activo
  const backend = tf.getBackend();
  console.log(`Backend activo: ${backend}`);

  return backend;
}

// Exportamos tf para poder usarlo en otros archivos
export { tf };
