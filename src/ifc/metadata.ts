import WebIFC from "@/utility/WebIFC";
import { FILE_NAME, IFCPROJECT } from "web-ifc";
import type { FlatMesh } from "web-ifc";
import type { ModelID } from "./file";

export type IfcTypeMetadata = {
  name: string;
};
export type IfcTypeDirectory = Record<number, IfcTypeMetadata>;

export type ProjectInfoResult = {
  projectName: string | null;
  author: string | null;
  organization: string | null;
  application: string | null;
};

export async function indexIfcTypes(id: ModelID): Promise<IfcTypeDirectory> {
  return (await WebIFC)
    .GetAllTypesOfModel(id)
    .reduce<IfcTypeDirectory>((directory, item) => {
      directory[item.typeID] = { name: item.typeName };
      return directory;
    }, {});
}

export async function populateDirectory(
  id: ModelID,
  directory: IfcTypeDirectory,
) {
  for (const [typeID, metadata] of Object.entries(directory)) {
    (await WebIFC).StreamAllMeshesWithTypes(id, [Number(typeID)], (flatMesh) =>
      console.log(flatMesh),
    );
  }
}

export async function iterateGeometry(id: ModelID) {
  const seen = new Set();
  return (await WebIFC).StreamAllMeshes(id, (flatMesh: FlatMesh) => {
    if (seen.has(flatMesh.expressID)) {
      console.log("Duplicate mesh ID:", flatMesh.expressID);
    }
    seen.add(flatMesh.expressID);
  });
}

export async function getProjectInfo(id: ModelID): Promise<ProjectInfoResult> {
  const api = await WebIFC;

  // FILE_NAME header: ('name', 'timestamp', ('author',...), ('org',...), 'preprocessor', 'originating_system', 'auth')
  let author: string | null = null;
  let organization: string | null = null;
  let application: string | null = null;
  try {
    const header = api.GetHeaderLine(id, FILE_NAME);
    const args = header?.arguments;
    if (args) {
      const rawAuthor = args[2]; // array of strings
      author = Array.isArray(rawAuthor)
        ? rawAuthor.map((a: any) => a?.value ?? a).filter(Boolean).join(", ") || null
        : (rawAuthor?.value ?? null);

      const rawOrg = args[3]; // array of strings
      organization = Array.isArray(rawOrg)
        ? rawOrg.map((o: any) => o?.value ?? o).filter(Boolean).join(", ") || null
        : (rawOrg?.value ?? null);

      // Preprocessor/originating system — prefer [5] (originating system, usually the authoring app)
      const rawApp = args[5] ?? args[4];
      application = rawApp?.value ?? (typeof rawApp === "string" ? rawApp : null);
    }
  } catch {
    // Header may be absent in some files
  }

  // IFCPROJECT entity — project name
  let projectName: string | null = null;
  try {
    const ids = api.GetLineIDsWithType(id, IFCPROJECT);
    if (ids.size() > 0) {
      const project = api.GetLine(id, ids.get(0));
      projectName = project?.LongName?.value ?? project?.Name?.value ?? null;
    }
  } catch {
    // Entity may be missing
  }

  return { projectName, author, organization, application };
}
