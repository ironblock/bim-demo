/**
 * Based on ifcModel.ts from babylon-ifc-loader v1.0.2 by Andrei Stepanov (aka
 * eldinor), used under the Apache 2.0 license.
 *
 * The source code herein has been modified by Corey Vixie.
 *
 * Original File:
 * https://github.com/eldinor/ifc-babylon/blob/72a4a88ce65b48eebda38bc29540740cd9e9062d/src/ifcModel.ts
 */

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
import type { RawGeometryPart, RawIfcModel } from "babylon-ifc-loader";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Configuration for scene building */
export interface SceneBuildOptions {
  mergeMeshes?: boolean; // default: true
  autoCenter?: boolean; // default: true
  doubleSided?: boolean; // default: true (backFaceCulling=false)
  generateNormals?: boolean; // default: false
  verbose?: boolean; // default: true
  freezeAfterBuild?: boolean; // default: true
}

/** Result of building a scene */
export interface SceneBuildResult {
  meshes: AbstractMesh[];
  rootNode: TransformNode;
  stats: BuildStats;
}

/** Statistics from scene building */
export interface BuildStats {
  originalPartCount: number;
  finalMeshCount: number;
  mergedGroupCount: number;
  skippedGroupCount: number;
  materialCount: number;
  buildTimeMs: number;
}

/** Bounds information */
export interface BoundsInfo {
  min: Vector3;
  max: Vector3;
  center: Vector3;
  size: Vector3;
  diagonal: number;
}

/** Private interface for mesh with color */
interface MeshWithColor {
  mesh: Mesh;
  colorId: number;
  color: { x: number; y: number; z: number; w: number } | null;
}

// ============================================================================
// PUBLIC API - Scene Building
// ============================================================================

/**
 * Build a Babylon.js scene from raw IFC model data
 */
export function buildIfcModel(
  model: RawIfcModel,
  scene: Scene,
  options: SceneBuildOptions = {},
): SceneBuildResult {
  const startTime = performance.now();

  const opts: SceneBuildOptions = {
    mergeMeshes: true,
    autoCenter: true,
    doubleSided: true,
    generateNormals: false,
    verbose: true,
    freezeAfterBuild: true,
    ...options,
  };

  if (opts.verbose) {
    console.log(
      `\n🏗️  Building Babylon.js scene from ${model.parts.length} raw parts...`,
    );
  }

  // Create root transform node (without scaling yet)
  const rootNode = new TransformNode("ifc-root", scene);

  // Create meshes from raw parts
  const meshesWithColor: MeshWithColor[] = model.parts.map((part) => {
    return createMeshFromPart(part, model.modelID, scene, rootNode, opts);
  });

  if (opts.verbose) {
    console.log(`  Created ${meshesWithColor.length} initial meshes`);
  }

  // Group by (expressID + colorId)
  const meshGroups = groupMeshesByKey(meshesWithColor);

  if (opts.verbose) {
    console.log(
      `  Grouped into ${meshGroups.size} unique (expressID + material) combinations`,
    );
  }

  // Create materials and merge groups
  const materialCache = new Map<number, StandardMaterial>();
  const finalMeshes: AbstractMesh[] = [];
  let mergedCount = 0;
  let skippedCount = 0;
  let materialZOffset = 0;

  meshGroups.forEach((group) => {
    const meshes = group.map((item) => item.mesh);
    if (!group[0] || !meshes[0]) return;

    const expressID = meshes[0].metadata!.expressID;
    const colorId = group[0].colorId;
    const color = group[0].color;

    // Get or create material
    const material = getMaterial(
      colorId,
      color,
      scene,
      materialCache,
      materialZOffset,
      opts,
    );
    // Increment z-offset with modulo to prevent infinite growth
    materialZOffset = (materialZOffset + 0.05) % 1.0;

    if (meshes.length === 1) {
      // Single mesh - no merging needed
      const mesh = meshes[0];
      mesh.name = `ifc-${expressID}`;
      mesh.material = material;
      finalMeshes.push(mesh);
    } else if (opts.mergeMeshes) {
      // Multiple meshes - check if we can merge
      const canMerge = canMergeMeshes(meshes, model.storeyMap);

      if (canMerge) {
        // Safe to merge
        const mergedMesh = Mesh.MergeMeshes(
          meshes,
          true, // disposeSource
          true, // allow32BitsIndices
          undefined, // meshSubclass
          false, // subdivideWithSubMeshes
          false, // multiMultiMaterials
        );

        if (mergedMesh) {
          mergedMesh.name = `ifc-${expressID}`;
          mergedMesh.parent = rootNode;
          mergedMesh.material = material;
          mergedMesh.metadata = {
            expressID: expressID,
            modelID: model.modelID,
          };
          mergedMesh.isVisible = true;
          finalMeshes.push(mergedMesh);
          mergedCount++;
        } else {
          // Merge failed - keep original meshes
          meshes.forEach((mesh) => {
            mesh.name = `ifc-${expressID}`;
            mesh.material = material;
            finalMeshes.push(mesh);
          });
          skippedCount++;
        }
      } else {
        // Cannot merge - different storeys
        meshes.forEach((mesh) => {
          mesh.name = `ifc-${expressID}`;
          mesh.material = material;
          finalMeshes.push(mesh);
        });
        skippedCount++;
        if (opts.verbose) {
          console.log(
            `  ⚠ Skipped merging ${meshes.length} parts for expressID ${expressID} (different storeys)`,
          );
        }
      }
    } else {
      // Merging disabled - keep all meshes
      meshes.forEach((mesh) => {
        mesh.name = `ifc-${expressID}`;
        mesh.material = material;
        finalMeshes.push(mesh);
      });
    }
  });

  // Apply Z-axis flip for coordinate system conversion (IFC to Babylon)
  // This must be done AFTER all meshes are created and transforms are baked
  rootNode.scaling.z = -1;

  // Force update of world matrix to apply scaling
  rootNode.computeWorldMatrix(true);

  // Auto-center the model if requested
  if (opts.autoCenter) {
    const bounds = getModelBounds(finalMeshes);
    if (bounds) {
      const centerOffset = bounds.center;
      rootNode.position.subtractInPlace(centerOffset);
      if (opts.verbose) {
        console.log(
          `  📍 Model auto-centered at origin (offset: ${centerOffset.x.toFixed(2)}, ${centerOffset.y.toFixed(2)}, ${centerOffset.z.toFixed(2)})`,
        );
      }
    }
  }

  const buildTimeMs = performance.now() - startTime;

  const stats: BuildStats = {
    originalPartCount: model.rawStats.partCount,
    finalMeshCount: finalMeshes.length,
    mergedGroupCount: mergedCount,
    skippedGroupCount: skippedCount,
    materialCount: materialCache.size,
    buildTimeMs,
  };

  if (opts.verbose) {
    console.log(`\n✅ Model building complete:`);
    console.log(`  Original parts: ${stats.originalPartCount}`);
    console.log(`  Merged groups: ${stats.mergedGroupCount}`);
    console.log(`  Skipped groups: ${stats.skippedGroupCount}`);
    console.log(`  Final meshes: ${stats.finalMeshCount}`);
    console.log(`  Materials created: ${stats.materialCount}`);
    console.log(`  Build time: ${stats.buildTimeMs.toFixed(2)}ms`);
  }

  if (opts.freezeAfterBuild) {
    // Freeze only IFC meshes that are children of ifc-root
    const rootNode = scene.getTransformNodeByName("ifc-root");
    if (rootNode) {
      rootNode.getChildMeshes().forEach((mesh) => {
        mesh.freezeWorldMatrix();
      });
    }
    // Freeze IFC materials only
    scene.materials.forEach((material) => {
      if (material.name.startsWith("ifc-material-")) {
        material.freeze();
      }
    });
    if (opts.verbose) {
      console.log(`  IFC meshes and materials frozen for optimal performance`);
    }
  }

  return {
    meshes: finalMeshes,
    rootNode,
    stats,
  };
}

/**
 * Dispose all IFC meshes, materials, and the root node
 */
export function disposeIfcModel(scene: Scene): void {
  // Dispose all IFC materials
  let materialCount = 0;
  scene.materials.forEach((material) => {
    if (material.name.startsWith("ifc-material-")) {
      material.dispose();
      materialCount++;
    }
  });

  // Find and dispose the ifc-root node (this will dispose all child meshes)
  const rootNode = scene.getTransformNodeByName("ifc-root");
  if (rootNode) {
    rootNode.dispose();
    console.log(`✓ ifc-root node and all child meshes disposed`);
  }

  if (materialCount > 0) {
    console.log(`✓ ${materialCount} IFC materials disposed`);
  }
}

/**
 * Get model bounds for camera framing
 */
export function getModelBounds(meshes: AbstractMesh[]): BoundsInfo | null {
  if (meshes.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  let validBoundsFound = false;

  meshes.forEach((mesh) => {
    if (!mesh.isVisible || mesh.getTotalVertices() === 0) return;

    // Force update of bounding info
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(false, false);

    // Get the bounding info
    const boundingInfo = mesh.getBoundingInfo();

    // Get min and max in world space
    const min = boundingInfo.boundingBox.minimumWorld;
    const max = boundingInfo.boundingBox.maximumWorld;

    // Update bounds
    minX = Math.min(minX, min.x);
    minY = Math.min(minY, min.y);
    minZ = Math.min(minZ, min.z);
    maxX = Math.max(maxX, max.x);
    maxY = Math.max(maxY, max.y);
    maxZ = Math.max(maxZ, max.z);

    validBoundsFound = true;
  });

  if (!validBoundsFound) return null;

  const min = new Vector3(minX, minY, minZ);
  const max = new Vector3(maxX, maxY, maxZ);
  const center = new Vector3(
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  );
  const size = new Vector3(maxX - minX, maxY - minY, maxZ - minZ);
  const diagonal = Math.sqrt(
    size.x * size.x + size.y * size.y + size.z * size.z,
  );

  return { min, max, center, size, diagonal };
}

/**
 * Center the model at origin (useful for camera positioning)
 */
export function centerModelAtOrigin(
  meshes: AbstractMesh[],
  rootNode?: TransformNode,
): Vector3 {
  const bounds = getModelBounds(meshes);
  if (!bounds) return Vector3.Zero();

  const offset = bounds.center.clone();

  if (rootNode) {
    // Move the entire root node to center the model
    rootNode.position.subtractInPlace(offset);
  } else {
    // Move individual meshes
    meshes.forEach((mesh) => {
      mesh.position.subtractInPlace(offset);
    });
  }

  console.log(
    `📍 Model centered at origin, offset: (${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)})`,
  );

  return offset;
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Create a Babylon mesh from a raw geometry part
 */
function createMeshFromPart(
  part: RawGeometryPart,
  modelID: number,
  scene: Scene,
  rootNode: TransformNode,
  options: SceneBuildOptions,
): MeshWithColor {
  const meshName = `ifc-${part.expressID}-part-${part.geometryExpressID}`;
  const mesh = new Mesh(meshName, scene);
  mesh.parent = rootNode;

  // Add metadata
  mesh.metadata = {
    expressID: part.expressID,
    modelID: modelID,
  };

  // Check if normals need to be generated
  let normals = part.normals;
  if (options.generateNormals && normals.every((v) => v === 0)) {
    const tempNormals: number[] = [];
    VertexData.ComputeNormals(
      Array.from(part.positions),
      Array.from(part.indices),
      tempNormals,
    );
    normals = new Float32Array(tempNormals);
  }

  // Apply vertex data
  const vertexData = new VertexData();
  vertexData.positions = Array.from(part.positions);
  vertexData.normals = Array.from(normals);
  vertexData.indices = Array.from(part.indices);
  vertexData.applyToMesh(mesh);

  // Apply transformation
  if (part.flatTransform && part.flatTransform.length === 16) {
    const matrix = Matrix.FromArray(part.flatTransform);
    mesh.bakeTransformIntoVertices(matrix);
  }

  mesh.isVisible = true;

  return {
    mesh,
    colorId: part.colorId,
    color: part.color,
  };
}

/**
 * Group meshes by (expressID + colorId)
 */
function groupMeshesByKey(
  meshesWithColor: MeshWithColor[],
): Map<string, MeshWithColor[]> {
  const groupKey = (expressID: number, colorId: number) =>
    `${expressID}-${colorId}`;
  const meshGroups = new Map<string, MeshWithColor[]>();

  meshesWithColor.forEach((item) => {
    const expressID = item.mesh.metadata!.expressID;
    const key = groupKey(expressID, item.colorId);

    if (!meshGroups.has(key)) {
      meshGroups.set(key, []);
    }
    meshGroups.get(key)!.push(item);
  });

  return meshGroups;
}

/**
 * Get or create a material for a color
 */
function getMaterial(
  colorId: number,
  color: { x: number; y: number; z: number; w: number } | null,
  scene: Scene,
  materialCache: Map<number, StandardMaterial>,
  materialZOffset: number,
  options: SceneBuildOptions,
): StandardMaterial {
  if (materialCache.has(colorId)) {
    return materialCache.get(colorId)!;
  }

  const material = new StandardMaterial(`ifc-material-${colorId}`, scene);

  if (color) {
    material.diffuseColor = new Color3(color.x, color.y, color.z);
    material.alpha = color.w;
  } else {
    // Default gray color
    material.diffuseColor = new Color3(0.8, 0.8, 0.8);
  }

  // Add z-offset to prevent z-fighting
  material.zOffset = materialZOffset;

  // Set backface culling based on options
  material.backFaceCulling = !options.doubleSided;

  materialCache.set(colorId, material);
  return material;
}

/**
 * Check if meshes can be safely merged based on spatial context
 */
function canMergeMeshes(
  meshes: Mesh[],
  storeyMap: Map<number, number>,
): boolean {
  const storeyIDs = new Set<number>();

  meshes.forEach((mesh) => {
    const expressID = mesh.metadata?.expressID;
    if (expressID !== undefined) {
      const storeyID = storeyMap.get(expressID);
      if (storeyID) {
        storeyIDs.add(storeyID);
      }
    }
  });

  // Allow merge ONLY if all parts belong to same storey OR no storey assignment
  return storeyIDs.size <= 1;
}
