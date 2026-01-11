# 🎯 TapTapp AR - Resumen de Arquitectura

> Documento ejecutivo para toma de decisiones

---

## 📊 Estado Actual vs Competencia

| Métrica | TapTapp AR | MindAR | ARjs |
|---------|------------|--------|------|
| **Tiempo compilación** | ~0.93s ✅ | ~23.5s | N/A |
| **Bundle size** | <100KB ✅ | ~20MB | ~1MB |
| **Dependencias** | 3 (msgpack, ml-matrix, tinyqueue) ✅ | TensorFlow.js | OpenCV.js |
| **Non-rigid tracking** | ✅ Delaunay mesh | ❌ | ❌ |
| **Precisión** | Sub-pixel ✅ | Standard | Standard |

---

## 🔴 3 Mayores Cuellos de Botella

### 1. Filtros Gaussianos CPU (~40% tiempo compilación)
```
Problema: _applyGaussianFilter() ejecuta O(10×W×H×numOctaves) operaciones
Archivo:  detector-lite.js:181
Solución: Migrar a WASM SIMD → 4-8× speedup
```

### 2. NCC Tracking Brute-Force (~60% tiempo runtime)
```
Problema: _computeMatching() ejecuta ~2.2M operaciones/frame
Archivo:  tracker.js:235
Solución: WASM SIMD batching → 3× speedup
```

### 3. Escalas Redundantes (8 escalas en lugar de 4)
```
Problema: buildImageList() genera demasiadas octavas
Archivo:  image-list.js:18
Solución: Aumentar SCALE_STEP_EXPONENT de 0.6 a 1.0
```

---

## 🎯 Recomendación: WASM SIMD Core

### ¿Por qué WASM SIMD?

| Criterio | Score |
|----------|-------|
| Rendimiento | ⭐⭐⭐⭐ (4-8× más rápido) |
| Compatibilidad | ⭐⭐⭐⭐⭐ (~95% browsers) |
| Esfuerzo migración | ⭐⭐⭐ (incremental, función por función) |
| Tamaño bundle | ⭐⭐⭐⭐⭐ (<100KB adicionales) |

### Roadmap de Migración

```
Semana 1-2: gaussian_blur_simd + downsample_simd
Semana 3:   find_extrema_simd + compute_freak_simd  
Semana 4:   ncc_batch_simd + bilinear_warp_simd
Semana 5:   Tests de integración + benchmarks
```

### Resultado Esperado

| Métrica | Actual | Post-WASM |
|---------|--------|-----------|
| Compilación | ~0.93s | ~150ms |
| Tracking latency | ~25ms | ~8ms |
| GC pressure | Alto | Bajo |

---

## ✅ Quick Wins (Aplicables HOY)

1. **Reducir escalas**: Cambiar `SCALE_STEP_EXPONENT` de 0.6 a 1.0
   - **Impacto**: -40% tiempo compilación
   - **Riesgo**: Bajo (aún detecta escalas 1%, 10%, 100%)

2. **Lazy load detector**: No crear `DetectorLite` hasta que se necesite
   - **Impacto**: -50ms startup
   - **Riesgo**: Ninguno

3. **TypedArray pooling**: Reusar buffers para `Float32Array`
   - **Impacto**: -30% GC jank
   - **Riesgo**: Bajo

---

## 📁 Documentación Completa

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para:
- Diagramas detallados de cada subsistema
- Análisis de complejidad algorítmica
- Comparativa de 4 arquitecturas alternativas
- Plan de migración detallado con Gantt chart
