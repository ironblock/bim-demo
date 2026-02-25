import { useEffect } from "react";
import { type BabylonInstanceRef } from "./useBabylonInstance";

export function useEngineResize(instance: BabylonInstanceRef) {
  useEffect(() => {
    const handler = async () => {
      (await instance.current)?.engine.resize();
    };

    window.addEventListener("resize", handler);

    return () => {
      window.removeEventListener("resize", handler);
    };
  }, [instance]);
}
