import { createDefaultCamera } from "@/babylon/camera";
import { createEngine } from "@/babylon/engine";
import { createDefaultLight } from "@/babylon/lighting";
import {
  Camera,
  Engine,
  Light,
  Scene,
  ScenePerformancePriority,
  WebGPUEngine,
} from "@babylonjs/core";
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
      const scene = new Scene(engine, {
        // Speed up geometry/material lookups at the cost of some memory
        // useGeometryUniqueIdsMap: true,
        // useMaterialMeshMap: true,
      });

      // Skip picking on pointer move — we only pick on click (useIfcPicking)
      scene.skipPointerMovePicking = true;

      // The IFC viewer renders to the full canvas every frame; no need to clear
      scene.autoClear = false;
      scene.autoClearDepthAndStencil = false;

      // Aggressive priority: skips per-frame frustum clipping and bounding sync.
      // Appropriate for large static scenes where all geometry is typically visible.
      scene.performancePriority = ScenePerformancePriority.Aggressive;

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
