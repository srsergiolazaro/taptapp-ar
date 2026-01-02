import { Controller } from "./controller.js";
import { Compiler } from "./compiler.js";

export { Controller, Compiler };

if (!window.MINDAR) {
  window.MINDAR = {};
}

window.MINDAR.IMAGE = {
  Controller,
  Compiler,
};
