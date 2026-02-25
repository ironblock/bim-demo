import {
  ArcRotateCamera,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

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
  target: TransformNode,
  camera: ArcRotateCamera,
) {
  camera.useFramingBehavior = true;
  camera.setTarget(target.absolutePosition);
}
