import {
  AbstractMesh,
  Color3,
  Matrix,
  Mesh,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import type { GeometryGroup } from "./geometry";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SceneBuildOptions {
  doubleSided?: boolean; // default: true
  autoCenter?: boolean; // default: true
  freezeAfterBuild?: boolean; // default: true
  verbose?: boolean; // default: true
  chunkSize?: number; // groups per event-loop yield, default: 100
}

export interface BuildProgress {
  phase: "building" | "finalizing";
  done: number;
  total: number;
}

export interface SceneBuildResult {
  /** All base meshes (one per unique geometry+color group) */
  meshes: AbstractMesh[];
  rootNode: TransformNode;
  stats: BuildStats;
}

export interface BuildStats {
  groupCount: number;
  instancedGroupCount: number;
  singletonGroupCount: number;
  totalInstances: number;
  buildTimeMs: number;
}

export interface BoundsInfo {
  min: Vector3;
  max: Vector3;
  center: Vector3;
  size: Vector3;
  diagonal: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getModelBounds(meshes: AbstractMesh[]): BoundsInfo | null {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  let found = false;

  for (const mesh of meshes) {
    if (!mesh.isVisible || mesh.getTotalVertices() === 0) continue;
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(false, false);
    const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox;
    minX = Math.min(minX, minimumWorld.x);
    maxX = Math.max(maxX, maximumWorld.x);
    minY = Math.min(minY, minimumWorld.y);
    maxY = Math.max(maxY, maximumWorld.y);
    minZ = Math.min(minZ, minimumWorld.z);
    maxZ = Math.max(maxZ, maximumWorld.z);
    found = true;
  }

  if (!found) return null;

  const center = new Vector3(
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  );
  const size = new Vector3(maxX - minX, maxY - minY, maxZ - minZ);
  return {
    min: new Vector3(minX, minY, minZ),
    max: new Vector3(maxX, maxY, maxZ),
    center,
    size,
    diagonal: Math.sqrt(size.x ** 2 + size.y ** 2 + size.z ** 2),
  };
}

function getMaterial(
  group: GeometryGroup,
  scene: Scene,
  cache: Map<number, StandardMaterial>,
  zOffset: number,
  doubleSided: boolean,
): StandardMaterial {
  if (cache.has(group.colorId)) return cache.get(group.colorId)!;

  const mat = new StandardMaterial(`ifc-material-${group.colorId}`, scene);
  if (group.color) {
    mat.diffuseColor = new Color3(group.color.x, group.color.y, group.color.z);
    mat.alpha = group.color.w;
  } else {
    mat.diffuseColor = new Color3(0.8, 0.8, 0.8);
  }
  mat.zOffset = zOffset;
  mat.backFaceCulling = !doubleSided;
  cache.set(group.colorId, mat);
  return mat;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a Babylon.js scene from deduplicated geometry groups.
 *
 * Each group becomes one base Mesh. Groups with multiple instances use
 * thin instances (one GPU draw call regardless of instance count). Groups
 * with a single instance skip the thin instance path.
 *
 * Yields BuildProgress after each chunk, allowing the caller to keep the
 * UI responsive. The generator's return value is the SceneBuildResult.
 */
export async function* buildScene(
  groups: GeometryGroup[],
  modelID: number,
  scene: Scene,
  options: SceneBuildOptions = {},
): AsyncGenerator<BuildProgress, SceneBuildResult, void> {
  const startTime = performance.now();
  const opts = {
    doubleSided: true,
    autoCenter: true,
    freezeAfterBuild: true,
    verbose: true,
    chunkSize: 1024,
    ...options,
  };

  if (opts.verbose) {
    console.info(
      `Building scene from ${groups.length} geometry groups (${groups.reduce((n, g) => n + g.instances.length, 0)} total instances)`,
    );
  }

  const rootNode = new TransformNode("ifc-root", scene);
  const materialCache = new Map<number, StandardMaterial>();
  const finalMeshes: AbstractMesh[] = [];
  let instancedGroups = 0;
  let singletonGroups = 0;
  let totalInstances = 0;
  let zOffset = 0;

  // ── Build groups in chunks ────────────────────────────────────────────────
  for (let i = 0; i < groups.length; i += opts.chunkSize) {
    const chunk = groups.slice(i, i + opts.chunkSize);

    if (opts.verbose) {
      console.info(
        `Processing chunk ${Math.ceil((i + opts.chunkSize) / opts.chunkSize)} of ${Math.ceil(groups.length / opts.chunkSize)}...`,
      );
    }

    for (const group of chunk) {
      const material = getMaterial(
        group,
        scene,
        materialCache,
        zOffset,
        opts.doubleSided,
      );
      zOffset = (zOffset + 0.05) % 1.0;

      // Upload vertex data
      const mesh = new Mesh(`ifc-geo-${group.geometryExpressID}`, scene);
      // TODO: Could parent this spatially to the story/floor, etc.
      mesh.parent = rootNode;
      mesh.material = material;
      //TODO: Disabled for performance reasons
      mesh.isPickable = false;
      mesh.isVisible = true;

      const vertexData = new VertexData();
      vertexData.positions = Array.from(group.positions);
      vertexData.normals = Array.from(group.normals);
      vertexData.indices = Array.from(group.indices);
      vertexData.applyToMesh(mesh);

      totalInstances += group.instances.length;

      if (group.instances.length === 1) {
        // Singleton — set world matrix directly, no thin instance overhead
        const singleton = group.instances[0]!;
        const mat = Matrix.FromArray(singleton.matrix);
        mesh.metadata = { expressID: singleton.expressID, modelID };
        mesh.setPreTransformMatrix(mat);
        mesh.freezeWorldMatrix();
        singletonGroups++;
      } else {
        // Multiple instances — use thin instances
        const matrixBuffer = new Float32Array(group.instances.length * 16);
        const expressIDs: number[] = new Array(group.instances.length);

        // TODO: Bet this could be done faster with a compute shader
        for (let j = 0; j < group.instances.length; j++) {
          const inst = group.instances[j]!;
          matrixBuffer.set(inst.matrix, j * 16);
          expressIDs[j] = inst.expressID;
        }

        mesh.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
        //TODO: Disabled for performance reasons
        mesh.thinInstanceEnablePicking = false;
        mesh.metadata = { expressIDs, modelID };
        mesh.freezeWorldMatrix();
        instancedGroups++;
      }

      finalMeshes.push(mesh);
    }

    yield {
      phase: "building",
      done: Math.min(i + opts.chunkSize, groups.length),
      total: groups.length,
    };

    await new Promise<void>((resolve) =>
      requestIdleCallback(() => resolve(), { timeout: 64 }),
    );
  }

  // ── Finalize ──────────────────────────────────────────────────────────────
  yield { phase: "finalizing", done: 0, total: 1 };

  // IFC uses a right-handed Z-up coordinate system; Babylon is left-handed Y-up.
  // Flipping Z on the root node handles the handedness conversion.
  rootNode.scaling.z = -1;
  rootNode.computeWorldMatrix(true);

  // if (opts.autoCenter) {
  //   const bounds = getModelBounds(finalMeshes);
  //   if (bounds) {
  //     rootNode.position.subtractInPlace(bounds.center);
  //     if (opts.verbose) {
  //       console.info(
  //         `Auto-centered model (offset: ${bounds.center.x.toFixed(2)}, ${bounds.center.y.toFixed(2)}, ${bounds.center.z.toFixed(2)})`,
  //       );
  //     }
  //   }
  // }

  if (opts.freezeAfterBuild) {
    // TODO: Currently freezing after creating each mesh for performance reasons
    // rootNode.getChildMeshes().forEach((m) => m.freezeWorldMatrix());
    scene.materials.forEach((m) => {
      if (m.name.startsWith("ifc-material-")) m.freeze();
    });
  }

  const buildTimeMs = performance.now() - startTime;
  const stats: BuildStats = {
    groupCount: groups.length,
    instancedGroupCount: instancedGroups,
    singletonGroupCount: singletonGroups,
    totalInstances,
    buildTimeMs,
  };

  if (opts.verbose) {
    console.info(
      `Scene built in ${Math.ceil(buildTimeMs)}ms — ` +
        `${groups.length} groups, ${instancedGroups} instanced, ${singletonGroups} singletons, ` +
        `${totalInstances} total placements`,
    );
  }

  return { meshes: finalMeshes, rootNode, stats };
}

/**
 * Dispose all IFC meshes, materials, and the root node from the scene.
 */
export function disposeScene(scene: Scene): void {
  scene.materials.forEach((m) => {
    if (m.name.startsWith("ifc-material-")) m.dispose();
  });
  scene.getTransformNodeByName("ifc-root")?.dispose();
}
