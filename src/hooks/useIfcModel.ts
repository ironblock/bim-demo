import { type IfcAPI } from "web-ifc";
import {
  type AbstractMesh,
  type ArcRotateCamera,
  type TransformNode,
} from "@babylonjs/core";
import {
  loadIfcModel,
  closeIfcModel,
  buildIfcModel,
  disposeIfcModel,
  getProjectInfo,
  getModelBounds,
  type ProjectInfoResult,
} from "babylon-ifc-loader";
import { useRef, useState, useCallback, type RefObject } from "react";
import { type BabylonInstance } from "./useBabylonInstance";
import WebIFC from "@/utility/WebIFC";

function adjustCameraToMeshes(meshes: AbstractMesh[], camera: ArcRotateCamera) {
  if (meshes.length === 0) return;

  const bounds = getModelBounds(meshes);
  if (!bounds) return;

  camera.target = bounds.center;
  camera.radius = bounds.diagonal * 1.5;
  camera.alpha = -Math.PI / 4;
  camera.beta = Math.PI / 3;
  camera.lowerRadiusLimit = bounds.diagonal * 0.3;
  camera.upperRadiusLimit = bounds.diagonal * 5;
  camera.wheelPrecision = bounds.diagonal * 0.01;
}

export type IfcModelState = {
  meshes: AbstractMesh[];
  modelID: number;
  rootNode: TransformNode;
  projectInfo: ProjectInfoResult;
};

export function useIfcModel(instance: RefObject<BabylonInstance | null>) {
  const currentModelID = useRef<number | null>(null);
  const [modelState, setModelState] = useState<IfcModelState | null>(null);

  const loadModel = useCallback(
    async (source: string | File) => {
      const api = await WebIFC;
      const scene = instance.current?.scene;
      const camera = instance.current?.camera as ArcRotateCamera | undefined;

      if (!api || !scene) return;

      // Dispose previous model
      if (currentModelID.current !== null) {
        disposeIfcModel(scene);
        closeIfcModel(api, currentModelID.current);
        currentModelID.current = null;
      }

      setModelState(null);

      const raw = await loadIfcModel(api, source, {
        coordinateToOrigin: true,
      });

      const { meshes, rootNode } = buildIfcModel(raw, scene, {
        autoCenter: true,
        mergeMeshes: true,
        doubleSided: true,
        generateNormals: false,
        freezeAfterBuild: true,
      });

      currentModelID.current = raw.modelID;

      const projectInfo = getProjectInfo(api, raw.modelID);

      if (camera && meshes.length > 0) {
        adjustCameraToMeshes(meshes, camera);
      }

      setModelState({ meshes, modelID: raw.modelID, rootNode, projectInfo });
    },
    [instance],
  );

  return { modelState, loadModel };
}
