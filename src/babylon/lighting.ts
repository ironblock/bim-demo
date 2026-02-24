import { HemisphericLight, Scene, Vector3 } from "@babylonjs/core";

export function createDefaultLight(scene: Scene): HemisphericLight {
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.7;
  return light;
}
