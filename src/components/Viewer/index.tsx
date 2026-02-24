"use client";

import { useRef, type RefObject } from "react";
import { useBabylonInstance } from "../../hooks/useBabylonInstance";
import { useEngineResize } from "../../hooks/useEngineResize";
import { useBabylonInspector } from "../../hooks/useBabylonInspector";
import styles from "./Viewer.module.css";

export default function Viewer() {
  const canvas: RefObject<HTMLCanvasElement | null> = useRef(null);
  const scene = useBabylonInstance(canvas);
  useEngineResize(scene);
  useBabylonInspector(scene);

  return <canvas ref={canvas} className={styles.canvas} />;
}
