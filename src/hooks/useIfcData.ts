import { adjustCameraToMeshes } from "@/babylon/camera";
import { buildIfcModel, disposeIfcModel, type BuildProgress } from "@/babylon/ifc";
import WebIFC from "@/utility/WebIFC";
import {
  type AbstractMesh,
  type ArcRotateCamera,
  type TransformNode,
} from "@babylonjs/core";
import {
  closeIfcModel,
  getProjectInfo,
  loadIfcModel,
  type ProjectInfoResult,
} from "babylon-ifc-loader";
import { useRef, useSyncExternalStore, type RefObject } from "react";
import { type BabylonInstance } from "./useBabylonInstance";

export interface IfcFileStatus {
  status: "idle" | "loading" | "ready";
}
interface IdleState extends IfcFileStatus {
  status: "idle";
}
interface LoadingState extends IfcFileStatus {
  status: "loading";
  progress: BuildProgress | null;
}
interface ReadyState extends IfcFileStatus {
  status: "ready";
  meshes: AbstractMesh[];
  modelID: number;
  rootNode: TransformNode;
  projectInfo: ProjectInfoResult;
}

export type IfcModelState = IdleState | LoadingState | ReadyState;

class IfcModelStore {
  private state: IfcModelState = { status: "idle" };
  private listeners = new Set<() => void>();

  getSnapshot = (): IfcModelState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private setState(next: IfcModelState) {
    this.state = next;
    this.notify();
  }

  async load(source: string | File, instance: BabylonInstance) {
    const { scene, camera } = instance;

    // Dispose previous model if one is loaded
    if (this.state.status === "ready") {
      const { modelID } = this.state;
      disposeIfcModel(scene);
      closeIfcModel(await WebIFC, modelID);
    }

    this.setState({ status: "loading", progress: null });

    const api = await WebIFC;

    const raw = await loadIfcModel(api, source, {
      coordinateToOrigin: true,
    });

    const gen = buildIfcModel(raw, scene, {
      autoCenter: true,
      mergeMeshes: true,
      doubleSided: true,
      generateNormals: false,
      freezeAfterBuild: true,
    });

    let next = await gen.next();
    while (!next.done) {
      this.setState({ status: "loading", progress: next.value });
      next = await gen.next();
    }
    const { meshes, rootNode } = next.value;

    const projectInfo = getProjectInfo(api, raw.modelID);

    if (meshes.length > 0) {
      adjustCameraToMeshes(meshes, camera as ArcRotateCamera);
    }

    this.setState({
      status: "ready",
      meshes,
      modelID: raw.modelID,
      rootNode,
      projectInfo,
    });
  }
}

export function useIfcData(instance: RefObject<BabylonInstance | null>) {
  const store = useRef(new IfcModelStore());

  const ifcState = useSyncExternalStore(
    store.current.subscribe,
    store.current.getSnapshot,
  );

  const loadIfcFiles = (source: FileList) => {
    if (!instance.current || !source[0]) return;

    // TODO: Handle multiple files
    store.current.load(source[0], instance.current).catch((error) => {
      console.error("Failed to load IFC model:", error);
    });
  };

  return { ifcState, loadIfcFiles };
}
