import { load } from "@/ifc/file";
import { streamGeometry } from "@/ifc/geometry";
import { getProjectInfo, type ProjectInfoResult } from "@/ifc/metadata";
import { buildScene, disposeScene, type BuildProgress } from "@/ifc/scene";
import WebIFC from "@/utility/WebIFC";
import { type AbstractMesh, type TransformNode } from "@babylonjs/core";
import { useRef, useSyncExternalStore } from "react";
import {
  type BabylonInstance,
  type BabylonInstanceRef,
} from "./useBabylonInstance";

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

  async loadData(source: File, { scene, camera }: BabylonInstance) {
    // Dispose previous model if one is loaded
    if (this.state.status === "ready") {
      const { modelID } = this.state;
      disposeScene(scene);
      (await WebIFC).CloseModel(modelID);
    }

    this.setState({ status: "loading", progress: null });

    const modelID = await load(source);
    const api = await WebIFC;

    console.info("Parsing IFC file...");

    const projectInfo = await getProjectInfo(modelID);
    console.info(`Project Info:\n${JSON.stringify(projectInfo, null, 2)}`);

    // Stream and deduplicate geometry (no Babylon calls, runs synchronously)
    const groups = streamGeometry(api, modelID);
    console.info(`Extracted ${groups.length} geometry groups`);

    console.info(`Closing model ${modelID} and releasing resources`);
    api.CloseModel(modelID);

    console.info("Preparing to build scene from extracted geometry groups");
    const gen = buildScene(groups, modelID, scene, {
      doubleSided: true,
      autoCenter: true,
      freezeAfterBuild: true,
      verbose: true,
    });

    let next = await gen.next();
    while (!next.done) {
      this.setState({ status: "loading", progress: next.value });
      next = await gen.next();
    }
    const { meshes, rootNode } = next.value;

    // FIXME: Might need to calculate a bounding box
    // if (rootNode) {
    //   adjustCameraToMeshes(rootNode, camera as ArcRotateCamera);
    // }

    this.setState({ status: "ready", meshes, modelID, rootNode, projectInfo });
  }
}

export function useIfcData(instance: BabylonInstanceRef) {
  const store = useRef(new IfcModelStore());

  const ifcState = useSyncExternalStore(
    store.current.subscribe,
    store.current.getSnapshot,
  );

  const loadIfcFiles = async (source: FileList) => {
    if (!instance.current || !source[0]) return;

    // TODO: Handle multiple files
    store.current.loadData(source[0], await instance.current);
  };

  return { ifcState, loadIfcFiles };
}
