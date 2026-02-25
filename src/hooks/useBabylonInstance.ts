import { createDefaultCamera } from "@/babylon/camera";
import { createEngine } from "@/babylon/engine";
import { createDefaultLight } from "@/babylon/lighting";
import { Camera, Engine, Light, Scene, WebGPUEngine } from "@babylonjs/core";
import { useLayoutEffect, useRef, type RefObject } from "react";

export type BabylonInstance = {
  engine: WebGPUEngine | Engine;
  scene: Scene;
  camera: Camera;
  light: Light;
};

export type BabylonInstanceRef = RefObject<Promise<BabylonInstance> | null>;

export function useBabylonInstance(
  canvas: RefObject<HTMLCanvasElement | null>,
): BabylonInstanceRef {
  const ref: BabylonInstanceRef = useRef(null);

  useLayoutEffect(() => {
    if (!window || !canvas.current || ref.current) return;

    console.info("Initializing Babylon scene");

    ref.current = createEngine(canvas.current).then((engine) => {
      const scene = new Scene(engine);
      const instance: BabylonInstance = {
        engine,
        scene,
        camera: createDefaultCamera(scene),
        light: createDefaultLight(scene),
      };

      engine.runRenderLoop(() => {
        scene.render();
      });

      return instance;
    });

    return () => {
      console.info("Cleaning up Babylon scene");
      ref.current?.then(({ engine }) => engine.dispose());
      ref.current = null;
    };
  }, []);

  return ref;
}
