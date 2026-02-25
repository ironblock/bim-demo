import type { IfcAPI, FlatMesh } from "web-ifc";

export interface GeometryInstance {
  expressID: number;
  matrix: Float32Array; // 16 floats, column-major (directly from flatTransformation)
}

export interface GeometryGroup {
  geometryExpressID: number;
  colorId: number;
  color: { x: number; y: number; z: number; w: number } | null;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  instances: GeometryInstance[];
}

function colorId(color: { x: number; y: number; z: number; w: number } | null): number {
  if (!color) return 0;
  return (
    Math.floor(color.x * 255) +
    Math.floor(color.y * 255) * 256 +
    Math.floor(color.z * 255) * 65536 +
    Math.floor(color.w * 255) * 16777216
  );
}

/**
 * Stream all geometry from an open IFC model, deduplicating by (geometryExpressID, colorId).
 *
 * GetGeometry is called exactly once per unique geometry shape. Subsequent placements
 * of the same shape are recorded as additional instances with their own transform matrix.
 */
export function streamGeometry(api: IfcAPI, modelID: number): GeometryGroup[] {
  const groups = new Map<string, GeometryGroup>();

  api.StreamAllMeshes(modelID, (flatMesh: FlatMesh) => {
    const placedGeometries = flatMesh.geometries;

    for (let i = 0; i < placedGeometries.size(); i++) {
      const placed = placedGeometries.get(i);
      if (!placed || placed.geometryExpressID === undefined) continue;

      const id = colorId(placed.color ?? null);
      const key = `${placed.geometryExpressID}-${id}`;

      const instance: GeometryInstance = {
        expressID: flatMesh.expressID,
        matrix: new Float32Array(placed.flatTransformation),
      };

      if (groups.has(key)) {
        groups.get(key)!.instances.push(instance);
        continue;
      }

      // First occurrence — fetch and extract vertex data
      const geometry = api.GetGeometry(modelID, placed.geometryExpressID);
      if (!geometry) continue;

      try {
        const verts = api.GetVertexArray(
          geometry.GetVertexData(),
          geometry.GetVertexDataSize(),
        );
        const indices = api.GetIndexArray(
          geometry.GetIndexData(),
          geometry.GetIndexDataSize(),
        );

        if (verts.length === 0 || indices.length === 0) continue;

        const numVertices = verts.length / 6;
        const positions = new Float32Array(numVertices * 3);
        const normals = new Float32Array(numVertices * 3);

        for (let v = 0; v < numVertices; v++) {
          positions[v * 3]     = verts[v * 6]!;
          positions[v * 3 + 1] = verts[v * 6 + 1]!;
          positions[v * 3 + 2] = verts[v * 6 + 2]!;
          normals[v * 3]       = verts[v * 6 + 3]!;
          normals[v * 3 + 1]   = verts[v * 6 + 4]!;
          normals[v * 3 + 2]   = verts[v * 6 + 5]!;
        }

        groups.set(key, {
          geometryExpressID: placed.geometryExpressID,
          colorId: id,
          color: placed.color ?? null,
          positions,
          normals,
          indices: new Uint32Array(indices),
          instances: [instance],
        });
      } finally {
        (geometry as any).delete?.();
      }
    }
  });

  return Array.from(groups.values());
}
