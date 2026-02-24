import { useEffect, useState, type RefObject } from "react";
import { type BabylonInstance } from "./useBabylonInstance";

const MODIFIER_KEY = navigator?.platform?.includes("Mac")
  ? "metaKey"
  : "ctrlKey";

export function keyEventIsInspector(event: KeyboardEvent): boolean {
  return MODIFIER_KEY && event.code === "KeyI";
}

export function useBabylonInspector(
  instance: RefObject<BabylonInstance | null>,
) {
  const [inspectorLoaded, setInspectorLoaded] = useState(false);

  useEffect(() => {
    const handler = async (event: KeyboardEvent) => {
      if (!keyEventIsInspector(event)) return;

      event.preventDefault();

      const scene = instance.current?.scene;
      if (!scene) return;

      if (!inspectorLoaded) {
        try {
          await import("@babylonjs/inspector");
          setInspectorLoaded(true);
        } catch (error) {
          console.error("Failed to load Babylon Inspector:", error);
          return;
        }
      }

      if (scene.debugLayer.isVisible()) {
        scene.debugLayer.hide();
      } else {
        await scene.debugLayer.show({ embedMode: false });
      }
    };

    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [instance, inspectorLoaded]);
}
