# Advanced & Legacy Usage

This document contains advanced usage examples and legacy integrations for **TapTapp AR**.

## 1. Simple A-Frame Integration
The easiest way to use TapTapp AR in a web app with A-Frame:

```html
<script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
<script src="path/to/@srsergio/taptapp-ar/dist/index.js"></script>

<a-scene taar-image="imageTargetSrc: ./targets.taar;">
  <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
  <a-entity taar-image-target="targetIndex: 0">
    <a-plane position="0 0 0" height="0.552" width="1"></a-plane>
  </a-entity>
</a-scene>
```

## 2. High-Performance Three.js Wrapper
For custom Three.js applications:

```javascript
import { TaarThree } from '@srsergio/taptapp-ar';

const taarThree = new TaarThree({
  container: document.querySelector("#container"),
  imageTargetSrc: './targets.taar',
});

const {renderer, scene, camera} = taarThree;

const anchor = taarThree.addAnchor(0);
// Add your 3D models to anchor.group

await taarThree.start();
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});
```

## 3. Raw Controller (Advanced & Custom Engines)
The `Controller` is the core engine of TapTapp AR. You can use it to build your own AR components or integrate tracking into custom 3D engines.

### ⚙️ Controller Configuration
| Property | Default | Description |
| :--- | :--- | :--- |
| `inputWidth` | **Required** | The width of the video or image source. |
| `inputHeight` | **Required** | The height of the video or image source. |
| `maxTrack` | `1` | Max number of images to track simultaneously. |
| `warmupTolerance` | `5` | Frames of consistent detection needed to "lock" a target. |
| `missTolerance` | `5` | Frames of missed detection before considering the target "lost". |
| `filterMinCF` | `0.001` | Min cutoff frequency for the OneEuroFilter (reduces jitter). |
| `filterBeta` | `1000` | Filter beta parameter (higher = more responsive, lower = smoother). |
| `onUpdate` | `null` | Callback for tracking events (Found, Lost, ProcessDone). |
| `debugMode` | `false` | If true, returns extra debug data (cropped images, feature points). |
| `worker` | `null` | Pass a custom worker instance if using a specialized environment. |

### 🚀 Example: Tracking a Video Stream
Ideal for real-time AR apps in the browser:

```javascript
import { Controller } from '@srsergio/taptapp-ar';

const controller = new Controller({
  inputWidth: video.videoWidth,
  inputHeight: video.videoHeight,
  onUpdate: (data) => {
    if (data.type === 'updateMatrix') {
      const { targetIndex, worldMatrix } = data;
      if (worldMatrix) {
        console.log(`Target ${targetIndex} detected! Matrix:`, worldMatrix);
        // Apply worldMatrix (Float32Array[16]) to your 3D object
      } else {
        console.log(`Target ${targetIndex} lost.`);
      }
    }
  }
});

// Single target
await controller.addImageTargets('./targets.taar');

// OR multiple targets from different .taar files
await controller.addImageTargets(['./target1.taar', './target2.taar', './target3.taar']);
controller.processVideo(videoElement); // Starts the internal RAF loop
```

### 📸 Example: One-shot Image Matching
Use this for "Snap and Detect" features without a continuous video loop:

```javascript
const controller = new Controller({ inputWidth: 1024, inputHeight: 1024 });
await controller.addImageTargets('./targets.taar');

// 1. Detect features in a static image
const { featurePoints } = await controller.detect(canvasElement);

// 2. Attempt to match against a specific target index
const { targetIndex, modelViewTransform } = await controller.match(featurePoints, 0);

if (targetIndex !== -1) {
  // Found a match! Use modelViewTransform for initial pose estimation
}
```
