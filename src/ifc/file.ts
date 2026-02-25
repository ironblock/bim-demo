import WebIFC from "@/utility/WebIFC";

export type ModelID = number;

export function fileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;

  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }

  return `${bytes.toFixed(2)} ${units[i]}`;
}

export async function load(source: URL | File): Promise<ModelID> {
  let startTime = performance.now();
  let buffer: ArrayBuffer;
  let modelID: ModelID;

  switch (source.constructor) {
    case File:
      console.info(`Loading IFC file "${(source as File).name}"`);

      buffer = await (source as File).arrayBuffer();
      break;

    case URL:
      console.info(`Downloading IFC file from ${(source as URL).href}...`);

      const response = await fetch(source as URL);
      if (response.ok && response.arrayBuffer) {
        buffer = await response.arrayBuffer();
      } else {
        throw new Error(`Failed to load IFC file from ${(source as URL).href}`);
      }
      break;

    default:
      throw new Error(`Unsupported source type: ${source.constructor.name}`);
  }

  console.info(
    `Loaded file (${fileSize(buffer.byteLength)}) in ${Math.ceil(performance.now() - startTime)}ms`,
  );

  startTime = performance.now();

  const id: ModelID = (await WebIFC).OpenModel(new Uint8Array(buffer));
  console.info(
    `Opened model (ID: ${id})in ${Math.ceil(performance.now() - startTime)}ms`,
  );

  return id;
}
