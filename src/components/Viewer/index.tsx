"use client";

import {
  ArcRotateCamera,
  Camera,
  Engine,
  HemisphericLight,
  Light,
  Scene,
  Vector3,
} from "@babylonjs/core";
import {
  loadIfcModel,
  closeIfcModel,
  getProjectInfo,
} from "babylon-ifc-loader";
import {
  buildIfcModel,
  disposeIfcModel,
  getModelBounds,
  centerModelAtOrigin,
} from "babylon-ifc-loader";
import { useRef, useLayoutEffect, type RefObject } from "react";
import styles from "./Viewer.module.css";

export type RenderContext = {
  engine: Engine;
  scene: Scene;
  camera: Camera;
  light: Light;
  resizeHandler: () => void;
};

export function babylonSetup(canvas: HTMLCanvasElement): RenderContext {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  // Create a camera with initial position
  const camera = new ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 2.5,
    10,
    Vector3.Zero(),
    scene,
  );
  camera.attachControl(canvas, true);

  // Set some reasonable camera limits (will be updated when model loads)
  camera.lowerRadiusLimit = 1;
  camera.upperRadiusLimit = 1000;
  camera.wheelPrecision = 10;

  // Create a light
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  engine.runRenderLoop(() => {
    scene.render();
  });

  const resizeHandler = () => engine.resize();
  window.addEventListener("resize", resizeHandler);

  return { engine, scene, camera, light, resizeHandler };
}

export function babylonCleanup(context: RenderContext) {
  window.removeEventListener("resize", context.resizeHandler);
  context.engine.dispose();
}

export default function Viewer() {
  const canvas: RefObject<HTMLCanvasElement | null> = useRef(null);
  const render: RefObject<RenderContext | null> = useRef(null);

  useLayoutEffect(() => {
    if (canvas.current) {
      render.current = babylonSetup(canvas.current);
    }

    return () => {
      if (render.current) {
        babylonCleanup(render.current);
      }
    };
  });

  return (
    <canvas ref={canvas} className={styles.canvas} />
  );
}
