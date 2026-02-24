import { createDefaultCamera } from "@/babylon/camera";
import { createDefaultLight } from "@/babylon/lighting";
import { Camera, Engine, Light, Scene } from "@babylonjs/core";
import { useLayoutEffect, useRef, type RefObject } from "react";

export type BabylonInstance = {
  engine: Engine;
  scene: Scene;
  camera: Camera;
  light: Light;
};

let initialized = false;

export function useBabylonInstance(
  canvas: RefObject<HTMLCanvasElement | null>,
): RefObject<BabylonInstance | null> {
  const render = useRef<BabylonInstance>(null);

  useLayoutEffect(() => {
    if (!canvas.current || render.current) return;

    console.info("Initializing Babylon scene");
    const engine = new Engine(canvas.current, true);
    const scene = new Scene(engine);

    const camera = createDefaultCamera(scene);
    const light = createDefaultLight(scene);

    engine.runRenderLoop(() => {
      scene.render();
    });

    render.current = { engine, scene, camera, light };

    return () => {
      console.info("Cleaning up Babylon scene");
      render.current = null;
      engine.dispose();
    };
  }, []);

  return render;
}
