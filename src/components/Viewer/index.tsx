"use client";

import { useRef, useEffect } from "react";
import { useBabylonInstance } from "../../hooks/useBabylonInstance";
import { useEngineResize } from "../../hooks/useEngineResize";
import { useBabylonInspector } from "../../hooks/useBabylonInspector";
import { useIfcModel } from "../../hooks/useIfcModel";
import { useIfcPicking } from "../../hooks/useIfcPicking";
import { useIfcDrop } from "../../hooks/useIfcDrop";
import clsx from "clsx";
import InfoOverlay from "./InfoOverlay";
import styles from "./Viewer.module.css";

export default function Viewer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const instance = useBabylonInstance(canvas);
  const { isDragging, files } = useIfcDrop(canvas);
  const { modelState, loadModel } = useIfcModel(instance);
  const pickedElement = useIfcPicking(instance);

  useEngineResize(instance);
  useBabylonInspector(instance);

  return (
    <section
      className={clsx(styles.container, isDragging && styles.isDragging)}
    >
      <canvas ref={canvas} className={styles.babylonScene} />
      <InfoOverlay pickedElement={pickedElement} modelState={modelState} />
    </section>
  );
}
