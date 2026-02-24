"use client";

import { useRef, useEffect } from "react";
import { useBabylonInstance } from "../../hooks/useBabylonInstance";
import { useEngineResize } from "../../hooks/useEngineResize";
import { useBabylonInspector } from "../../hooks/useBabylonInspector";
import { useIfcModel } from "../../hooks/useIfcModel";
import { useIfcPicking } from "../../hooks/useIfcPicking";
import { useIfcDrop } from "../../hooks/useIfcDrop";
import InfoOverlay from "./InfoOverlay";
import styles from "./Viewer.module.css";

export default function Viewer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const instance = useBabylonInstance(canvas);
  useEngineResize(instance);
  useBabylonInspector(instance);

  const { modelState, loadModel } = useIfcModel(instance);
  const pickedElement = useIfcPicking(instance);
  const isDragging = useIfcDrop(canvas, loadModel);

  useEffect(() => {
    loadModel("/test.ifc").catch((error) => {
      console.error("Failed to load initial IFC file:", error);
    });
  }, [loadModel]);

  return (
    <div className={styles.container}>
      <canvas
        ref={canvas}
        className={`${styles.canvas}${isDragging ? ` ${styles.canvasDragging}` : ""}`}
      />
      <InfoOverlay pickedElement={pickedElement} modelState={modelState} />
    </div>
  );
}
