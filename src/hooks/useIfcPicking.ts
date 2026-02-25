import WebIFC from "@/utility/WebIFC";
import { Color3, type AbstractMesh } from "@babylonjs/core";
import { useEffect, useRef, useState, type RefObject } from "react";
import { type BabylonInstance } from "./useBabylonInstance";

export type PickedElementInfo = {
  typeName: string;
  elementName: string;
  expressID: number;
} | null;

export function useIfcPicking(
  instance: RefObject<BabylonInstance | null>,
): PickedElementInfo {
  const [pickedElement, setPickedElement] = useState<PickedElementInfo>(null);
  const highlightedMesh = useRef<AbstractMesh | null>(null);

  useEffect(() => {
    const scene = instance.current?.scene;
    if (!scene) return;

    scene.onPointerDown = async (evt, pickResult) => {
      if (evt.button !== 0) return;

      // Clear previous highlight
      if (highlightedMesh.current) {
        highlightedMesh.current.renderOverlay = false;
        highlightedMesh.current = null;
      }

      const mesh = pickResult.hit ? pickResult.pickedMesh : null;
      const metadata = mesh?.metadata;

      // Resolve expressID — thin-instanced meshes store an array keyed by thinInstanceIndex
      const expressID: number | undefined = metadata?.expressIDs
        ? metadata.expressIDs[pickResult.thinInstanceIndex ?? 0]
        : metadata?.expressID;
      const modelID: number | undefined = metadata?.modelID;

      if (expressID !== undefined && modelID !== undefined) {
        try {
          const element = (await WebIFC).GetLine(modelID, expressID, true);
          const typeName = (await WebIFC).GetNameFromTypeCode(element.type);
          const elementName = element.Name?.value ?? "Unnamed";

          mesh!.renderOverlay = true;
          mesh!.overlayColor = Color3.Teal();
          mesh!.overlayAlpha = 0.3;
          highlightedMesh.current = mesh!;

          setPickedElement({ typeName, elementName, expressID });
        } catch (error) {
          console.error("Failed to get element data:", error);
          setPickedElement(null);
        }
      } else {
        setPickedElement(null);
      }
    };
  }, [instance]);

  return pickedElement;
}
