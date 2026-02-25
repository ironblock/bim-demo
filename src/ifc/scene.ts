import {
  AbstractMesh,
  Color3,
  Material,
  Matrix,
  Mesh,
  Scene,
  SimplificationType,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import type { GeometryGroup } from "./geometry";

export type MaterialCache = Map<number, Material>;
const ROOT_NODE_NAME = "ifc-root";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SceneBuildOptions {
  doubleSided?: boolean; // default: true
  autoCenter?: boolean; // default: true
  freezeAfterBuild?: boolean; // default: true
  verbose?: boolean; // default: true
  chunkSize?: number; // groups per event-loop yield, default: 1024
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

/**
 * Returns a cached material for the given group, creating one if needed.
 * zOffset is incremented per-group by the caller to avoid z-fighting.
 */
function getOrCreateMaterial(
  group: GeometryGroup,
  scene: Scene,
  cache: MaterialCache,
  zOffset: number,
  doubleSided: boolean,
): Material {
  if (!group.color) {
    return scene.defaultMaterial;
  }

  if (cache.has(group.colorId)) {
    return cache.get(group.colorId)!;
  }

  console.info(`Creating material for group ${group.colorId}`);
  const material = new StandardMaterial(`ifc-material-${group.colorId}`, scene);
  material.diffuseColor = new Color3(
    group.color.x,
    group.color.y,
    group.color.z,
  );
  material.alpha = group.color.w;

  material.zOffset = zOffset;
  material.backFaceCulling = !doubleSided;

  cache.set(group.colorId, material);

  return material;
}

/**
 * Optimizes a Mesh by using Babylon's built-in Mesh.simplify on meshes that
 * have more than a certain number of faces. Will also configure LOD levels.
 *
 * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/simplifyingMeshes/
 * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/LOD
 */
async function optimizeGeometry<T extends Mesh>(
  mesh: T,
  maxTriangles: number = 500,
): Promise<T> {
  const initialIndices = mesh.getTotalIndices();
  let simplifiedIndices = initialIndices;

  await mesh.optimizeIndicesAsync();
  simplifiedIndices = mesh.getTotalIndices();
  if (initialIndices > simplifiedIndices) {
    console.info(
      `Optimized mesh ${mesh.name} with from indices ${initialIndices} to ${simplifiedIndices}`,
    );
  }

  if (simplifiedIndices / 3 > maxTriangles) {
    console.info(`Adding additional LODs to ${mesh.name}`);
    mesh.simplify(
      [
        { distance: 15, quality: 0.9 },
        { distance: 50, quality: 0.5 },
      ],
      false,
      SimplificationType.QUADRATIC,
    );
  }

  // mesh.useLODScreenCoverage = true;
  // When the mesh takes up less than 1% of the screen, don't render it.
  // mesh.addLODLevel(0.01, null);

  return mesh;
}

/**
 * Creates a Mesh for a geometry group: uploads vertex data, assigns material,
 * and parents it under rootNode. Does not apply instance transforms.
 */
function geometryGroupToMesh(
  group: GeometryGroup,
  scene: Scene,
  rootNode: TransformNode,
  material: Material,
): Mesh {
  const mesh = new Mesh(`ifc-geo-${group.geometryExpressID}`, scene);
  // TODO: Could parent this spatially to the story/floor, etc.
  mesh.parent = rootNode;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.thinInstanceEnablePicking = false;

  const vertexData = new VertexData();
  vertexData.positions = Array.from(group.positions);
  vertexData.normals = Array.from(group.normals);
  vertexData.indices = Array.from(group.indices);
  vertexData.applyToMesh(mesh);

  optimizeGeometry(mesh);

  return mesh;
}

/**
 * Applies instance transforms for a group onto the mesh and freezes its world
 * matrix. Singletons set the transform directly (cheaper — no thin instance
 * buffer). Multi-instance groups use thinInstanceSetBuffer.
 *
 * Returns "singleton" or "instanced" for stats tracking.
 */
function createInstances(
  mesh: Mesh,
  group: GeometryGroup,
  modelID: number,
): 1 | number {
  const { instances } = group;
  const expressIDs: number[] = new Array(instances.length);

  if (instances.length === 1) {
    const inst = instances[0]!;
    expressIDs[0] = inst.expressID;
    mesh.setPreTransformMatrix(Matrix.FromArray(inst.matrix));
  } else {
    const matrixBuffer = new Float32Array(instances.length * 16);

    // TODO: Bet this could be done faster with a compute shader
    for (let j = 0; j < instances.length; j++) {
      const inst = instances[j]!;
      matrixBuffer.set(inst.matrix, j * 16);
      expressIDs[j] = inst.expressID;
    }

    mesh.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
  }

  mesh.metadata = { expressIDs, modelID };
  mesh.freezeWorldMatrix();

  return instances.length;
}

/**
 * Finalizes the scene after all groups are built: applies the IFC→Babylon
 * coordinate-system conversion and optionally freezes all IFC materials.
 */
function finalizeScene(
  rootNode: TransformNode,
  scene: Scene,
  opts: { freezeAfterBuild: boolean },
): void {
  // IFC uses a right-handed Z-up coordinate system; Babylon is left-handed Y-up.
  // Flipping Z on the root node handles the handedness conversion.
  rootNode.scaling.z = -1;
  rootNode.computeWorldMatrix(true);

  if (opts.freezeAfterBuild) {
    // TODO: Currently freezing after creating each mesh for performance reasons
    // rootNode.getChildMeshes().forEach((m) => m.freezeWorldMatrix());
    scene.materials.forEach((m) => {
      if (m.name.startsWith("ifc-material-")) m.freeze();
    });
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a Babylon.js scene from deduplicated geometry groups.
 *
 * Each group becomes one base Mesh. All groups (including singletons) use thin
 * instances so the per-group logic is uniform. Yields BuildProgress after each
 * chunk, allowing the caller to keep the UI responsive. The generator's return
 * value is the SceneBuildResult.
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

  const totalInstances = groups.reduce((n, g) => n + g.instances.length, 0);

  if (opts.verbose) {
    console.info(
      `Building scene from ${groups.length} geometry groups (${totalInstances} total instances)`,
    );
  }

  const rootNode = new TransformNode(ROOT_NODE_NAME, scene);
  const materials: MaterialCache = new Map();
  const finalMeshes: AbstractMesh[] = [];
  let zOffset = 0;
  let singletonsTotal = 0;
  let instancesTotal = 0;

  // ── Build groups in chunks ────────────────────────────────────────────────
  for (let i = 0; i < groups.length; i += opts.chunkSize) {
    const chunk = groups.slice(i, i + opts.chunkSize);
    let singletonsInChunk = 0;
    let instancesInChunk = 0;

    if (opts.verbose) {
      console.group(
        `Processing chunk ${Math.ceil((i + opts.chunkSize) / opts.chunkSize)} of ${Math.ceil(groups.length / opts.chunkSize)}...`,
      );
    }

    for (const group of chunk) {
      const material = getOrCreateMaterial(
        group,
        scene,
        materials,
        zOffset,
        opts.doubleSided,
      );
      zOffset = (zOffset + 0.05) % 1.0;

      const mesh = geometryGroupToMesh(group, scene, rootNode, material);
      const instances = createInstances(mesh, group, modelID);

      if (instances === 1) {
        singletonsInChunk++;
      } else {
        instancesInChunk++;
      }

      finalMeshes.push(mesh);
    }

    singletonsTotal += singletonsInChunk;
    instancesTotal += instancesInChunk;

    if (opts.verbose) {
      console.info(
        `Processed ${singletonsInChunk} singleton meshes and ${instancesInChunk} mesh instances.`,
      );
      console.groupEnd();
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

  finalizeScene(rootNode, scene, opts);

  const buildTimeMs = performance.now() - startTime;
  const stats: BuildStats = {
    groupCount: groups.length,
    instancedGroupCount: instancesTotal,
    singletonGroupCount: singletonsTotal,
    totalInstances,
    buildTimeMs,
  };

  if (opts.verbose) {
    console.info(
      `Scene built in ${Math.ceil(buildTimeMs)}ms — ` +
        `${groups.length} unique meshes (${instancesTotal} instanced, ${singletonsTotal} singletons) ` +
        `${totalInstances} total placements`,
    );
  }

  return { meshes: finalMeshes, rootNode, stats };
}

/**
 * Dispose all IFC meshes, materials, and the root node from the scene.
 */
export function disposeScene(scene: Scene): void {
  scene.getTransformNodeByName(ROOT_NODE_NAME)?.dispose();
}
