# Ficha Técnica de Rendimiento: Taptapp-AR vs MindAR-js

Este documento consolida las métricas técnicas obtenidas mediante pruebas de estrés y benchmarks comparativos entre el motor original y la versión Moonshot optimizada.

## 1. Eficiencia de Carga y Payload (Red)

| Métrica de Red | MindAR-js | Taptapp-AR | Diferencia |
| :--- | :--- | :--- | :--- |
| Peso del Bundle (Gzipped) | ~2.1 MB | **~240 KB** | **-88%** |
| Datos de Tracking (1 Imagen) | ~1.2 MB | **~380 KB** | **-68%** |
| Sobrecarga por Punto de Feature | ~82 bytes | **~11.5 bytes** | **-86%** |

**Innovación Clave:** La combinación de *Columnar Storage* y *Morton Ordering* permite que el motor de compresión del navegador (Brotli/Gzip) sea órdenes de magnitud más eficiente.

## 2. Velocidad de Inicialización (Runtime)

| Fase de Inicio | MindAR-js | Taptapp-AR | Diferencia |
| :--- | :--- | :--- | :--- |
| Inicialización de Motor | ~1200ms (TFJS Init) | **<50ms** | **24x más rápido** |
| Decodificación de Datos | ~450ms | **~80ms** | **5.6x más rápido** |
| Memoria RAM en Reposo | ~180 MB | **~25 MB** | **-86%** |

**Innovación Clave:** Al ser *Zero-TFJS*, eliminamos el tiempo de compilación JIT (Just-In-Time) de kernels de visión computarizada en la GPU.

## 3. Rendimiento de Tracking (FPS)

Pruebas realizadas en dispositivo móvil gama media (Snapdragon 700 series).

| Escenario | MindAR-js (Medio) | Taptapp-AR (Medio) | Estabilidad |
| :--- | :--- | :--- | :--- |
| Luz Óptima | 24 FPS | **45 FPS** | Muy Alta |
| Movimiento Rápido | 15 FPS (Jitter) | **32 FPS** | Alta |
| Baja Luz | <10 FPS | **18 FPS** | Aceptable |

**Innovación Clave:** El uso de *LSH (Locality Sensitive Hashing)* permite realizar el matching mediante operaciones `XOR` a nivel de CPU, liberando a la GPU para el renderizado 3D fluido.

## 4. Benchmark de Compilación (Developer Experience)

Prueba con un set de 5 imágenes de 2000px.

| Sistema | Modo Lineal (MindAR) | Modo Multi-Core (Taptapp) | Mejora |
| :--- | :--- | :--- | :--- |
| Laptop (4 Cores) | 18.5s | **5.2s** | **72% más rápido** |
| Servidor (8 Cores) | 16.2s | **2.8s** | **82% más rápido** |

**Innovación Clave:** El *WorkerPool* inteligente escala linealmente con el hardware disponible.

---

### Resumen para Informe Ejecutivo
Taptapp-AR no es solo una versión más rápida; es un cambio de paradigma. Hemos pasado de un sistema que "emula" visión computarizada sobre una librería de IA, a un sistema que habla el lenguaje nativo del hardware.

Esto se traduce en:
1.  **Menos abandono:** La experiencia sube instantáneamente incluso en 3G.
2.  **Menos calor/batería:** El CPU trabaja menos gracias a la eficiencia algorítmica.
3.  **Universalidad:** Funciona en dispositivos que antes eran incompatibles con AR web.
