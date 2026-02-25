import { useFileDrop } from "@/hooks/useFileDrop";
import clsx from "clsx";
import { useRef } from "react";
import { useBabylonInspector } from "../../hooks/useBabylonInspector";
import { useBabylonInstance } from "../../hooks/useBabylonInstance";
import { useEngineResize } from "../../hooks/useEngineResize";
import { useIfcData } from "../../hooks/useIfcData";
import InfoOverlay from "./InfoOverlay";
import styles from "./Viewer.module.css";

export default function Viewer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const instance = useBabylonInstance(canvas);
  const { ifcState, loadIfcFiles } = useIfcData(instance);
  // const pickedElement = useIfcPicking(instance);
  const { isDragging } = useFileDrop(".ifc", canvas, (files) => {
    loadIfcFiles(files);
  });

  useEngineResize(instance);
  useBabylonInspector(instance);

  return (
    <section
      className={clsx(styles.container, isDragging && styles.isDragging)}
    >
      <canvas ref={canvas} className={styles.babylonScene} />
      <InfoOverlay pickedElement={null} modelState={ifcState} />
    </section>
  );
}
