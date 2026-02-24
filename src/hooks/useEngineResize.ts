import { useEffect, type RefObject } from "react";
import { type BabylonInstance } from "./useBabylonInstance";

export function useEngineResize(instance: RefObject<BabylonInstance | null>) {
  useEffect(() => {
    const handler = () => {
      instance.current?.engine.resize();
    };

    window.addEventListener("resize", handler);

    return () => {
      window.removeEventListener("resize", handler);
    };
  }, [instance]);
}
