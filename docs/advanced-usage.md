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

