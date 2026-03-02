import { threads } from "wasm-feature-detect";
import { IfcAPI } from "web-ifc";

/**
 * The web-ifc.wasm file isn't exported by the web-ifc package, so several intermediate
 * steps are required to load it.
 *
 * - The "web-ifc/*" aliases are included in tsconfig.json's "paths"
 * - Bun's file loader will include the file in the bundle somewhere
 * - `await import()` is used to retrieve the actual path from Bun's manifest
 */
export async function chooseWasmPath() {
  let path;

  if (await threads()) {
    console.info("Browser supports threads. Using multi-threaded WebIFC");
    path = require("web-ifc-mt-wasm");
  } else {
    console.info(
      "Browser does not support threads. Using single-threaded WebIFC",
    );
    path = require("web-ifc-wasm");
  }

  console.info(`Loading WASM from ${path}`);
  return path;
}

export async function configure(instance: IfcAPI) {
  const startTime = performance.now();

  // instance.SetWasmPath(await chooseWasmPath(), true);
  const path = await chooseWasmPath();
  await instance.Init(() => path);

  console.info(
    `WebIFC WASM instance started in ${Math.ceil(performance.now() - startTime)}ms`,
  );

  return instance;
}

export const WebIFC: Promise<IfcAPI> = configure(new IfcAPI());

export default WebIFC;
