import { type IfcAPI } from "web-ifc";
import { type AbstractMesh, Color3 } from "@babylonjs/core";
import { useEffect, useState, useRef, type RefObject } from "react";
import { type BabylonInstance } from "./useBabylonInstance";
import WebIFC from "@/utility/WebIFC";

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

      if (
        metadata?.expressID !== undefined &&
        metadata?.modelID !== undefined
      ) {
        try {
          const element = (await WebIFC).GetLine(
            metadata.modelID,
            metadata.expressID,
            true,
          );
          const typeName = (await WebIFC).GetNameFromTypeCode(element.type);
          const elementName = element.Name?.value ?? "Unnamed";

          mesh!.renderOverlay = true;
          mesh!.overlayColor = Color3.Teal();
          mesh!.overlayAlpha = 0.3;
          highlightedMesh.current = mesh!;

          setPickedElement({
            typeName,
            elementName,
            expressID: metadata.expressID,
          });
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
