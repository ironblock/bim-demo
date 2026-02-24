"use client";

import { useRef, useEffect, type RefObject } from "react";
import { useBabylonInstance } from "../../hooks/useBabylonInstance";
import { useEngineResize } from "../../hooks/useEngineResize";
import { useBabylonInspector } from "../../hooks/useBabylonInspector";
import { useIfcModel } from "../../hooks/useIfcModel";
import { useIfcPicking } from "../../hooks/useIfcPicking";
import { useIfcDrop } from "../../hooks/useIfcDrop";
import styles from "./Viewer.module.css";

export default function Viewer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const instance = useBabylonInstance(canvas);
  useEngineResize(instance);
  useBabylonInspector(instance);

  const { modelState, loadModel } = useIfcModel(instance);
  const pickedElement = useIfcPicking(instance);
  useIfcDrop(canvas, loadModel);

  let overlayText: string | null = null;
  if (pickedElement) {
    overlayText = `${pickedElement.typeName} | ${pickedElement.elementName} | ID: ${pickedElement.expressID}`;
  } else if (modelState?.projectInfo) {
    const { projectName, author, application } = modelState.projectInfo;
    const parts = [
      projectName && `Project: ${projectName}`,
      author && `Author: ${author}`,
      application && `App: ${application}`,
    ].filter(Boolean);
    overlayText = parts.join(" | ") || null;
  }

  return (
    <div className={styles.container}>
      <canvas ref={canvas} className={styles.canvas} />
      {overlayText && <div className={styles.overlay}>{overlayText}</div>}
    </div>
  );
}
