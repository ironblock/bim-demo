import { Engine, WebGPUEngine } from "@babylonjs/core";

export async function createEngine(
  canvas: HTMLCanvasElement | OffscreenCanvas,
) {
  if (await WebGPUEngine.IsSupportedAsync) {
    console.info("WebGPU is supported, Babylon will use WebGPUEngine.");
    const engine = new WebGPUEngine(canvas, { antialias: false });
    engine.compatibilityMode = true;
    await engine.initAsync();

    return engine;
  }

  console.info("WebGPU is not supported, Babylon will fall back to Engine");
  return new Engine(canvas, false);
}
