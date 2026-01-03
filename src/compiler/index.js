import { OfflineCompiler } from "./offline-compiler.js";

export { OfflineCompiler };

if (!window.MINDAR) {
  window.MINDAR = {};
}

window.MINDAR.IMAGE = {
  OfflineCompiler,
};
