import { AbstractMesh, ArcRotateCamera, Scene, Vector3 } from "@babylonjs/core";
import { getModelBounds } from "babylon-ifc-loader";

export function createDefaultCamera(scene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 2.5,
    10,
    Vector3.Zero(),
    scene,
  );
  camera.attachControl(null, true);
  camera.lowerRadiusLimit = 1;
  camera.upperRadiusLimit = 1000;
  camera.wheelPrecision = 10;

  return camera;
}

export function adjustCameraToMeshes(
  meshes: AbstractMesh[],
  camera: ArcRotateCamera,
) {
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
