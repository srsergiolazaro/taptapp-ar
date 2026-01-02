# @srsergio/taptapp-ar

AR Visualizer and Image Target Compiler for Astro and React.

## Features

- 🚀 **Astro-ready**: Built-in components for Astro projects.
- ⚛️ **React Support**: Advanced AREditor and Progress UI.
- 🖼️ **Offline Compiler**: Powerful image target compilation using TensorFlow.js.
- 📱 **Mobile Optimized**: Smooth performance on mobile devices.

## Installation

```bash
npm install @srsergio/taptapp-ar
```

Note: You should also have `three`, `aframe`, `react`, and `react-dom` installed in your project as peer dependencies.

## Usage

### Using the AR Visualizer in Astro

```astro
---
import ARVideoTrigger from '@srsergio/taptapp-ar/astro/ARVideoTrigger.astro';

const config = {
  targetImageSrc: '/path/to/image.jpg',
  targetMindSrc: '/path/to/targets.mind',
  videoSrc: '/path/to/video.mp4',
  videoWidth: 1280,
  videoHeight: 720,
  scale: 1,
};
---

<ARVideoTrigger config={config} />
```

### Using the AR Editor in React

```tsx
import { AREditor } from '@srsergio/taptapp-ar';

function MyEditor() {
  return <AREditor adminId="some-id" />;
}
```

### Using the Offline Compiler (Backend/Serverless)

```typescript
import { OfflineCompiler } from '@srsergio/taptapp-ar';

const compiler = new OfflineCompiler();
// ... logic to compile image targets
```

## License

MIT
