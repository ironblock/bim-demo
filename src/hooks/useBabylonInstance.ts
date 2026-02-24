import {
  ArcRotateCamera,
  Camera,
  Engine,
  HemisphericLight,
  Light,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { useRef, useLayoutEffect, type RefObject } from "react";

export type BabylonInstance = {
  engine: Engine;
  scene: Scene;
  camera: Camera;
  light: Light;
};

export function useBabylonInstance(
  canvas: RefObject<HTMLCanvasElement | null>,
): RefObject<BabylonInstance | null> {
  const render = useRef<BabylonInstance>(null);

  useLayoutEffect(() => {
    if (!canvas.current || render.current) return;

    console.info("Initializing Babylon scene");
    const engine = new Engine(canvas.current, true);
    const scene = new Scene(engine);

    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2.5,
      10,
      Vector3.Zero(),
      scene,
    );
    camera.attachControl(canvas.current, true);
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 1000;
    camera.wheelPrecision = 10;

    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

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
