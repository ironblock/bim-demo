import { initializeWebIFC } from "babylon-ifc-loader";
import type { IfcAPI } from "web-ifc";

/**
 * The web-ifc.wasm file isn't exported by the web-ifc package, so several intermediate
 * steps are required to load it.
 *
 * - The "web-ifc/wasm" alias is included as part of the tsconfig.json "paths" object.
 * - Bun's file loader will resolve the path and place the file appropriately
 * - `await import()` is used to retrieve the actual path from Bun's manifest
 */
export const wasmPath: string = (await import("web-ifc/wasm")).default;
export const WebIFC: Promise<IfcAPI> = initializeWebIFC(wasmPath);

export default WebIFC;
