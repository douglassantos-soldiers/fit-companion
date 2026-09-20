/**
 * Catalog coverage helpers — names / muscle / equipment only.
 * Never ingest GIFs, stills, instructions, or third-party media URLs.
 */
export type CoverageMuscle =
  | "peito"
  | "costas"
  | "pernas"
  | "ombros"
  | "biceps"
  | "triceps"
  | "core"
  | "cardio";

export type CoverageEquipment = "casa" | "academia" | "ambos";

export type CoverageStatus = "missing" | "covered" | "deferred";

export interface CoverageEntry {
  targetNamePt: string;
  muscleHint: CoverageMuscle;
  equipmentHint: CoverageEquipment;
  status: CoverageStatus;
  soldiersId?: string;
  loteHint?: string;
}

export interface LibraryIndexRow {
  id: string;
  name: string;
  group: CoverageMuscle;
  equipment: CoverageEquipment;
}

export function normalizeCatalogName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MUSCLE_ALIASES: Record<string, CoverageMuscle> = {
  peito: "peito",
  chest: "peito",
  costas: "costas",
  back: "costas",
  lats: "costas",
  pernas: "pernas",
  legs: "pernas",
  quads: "pernas",
  hamstrings: "pernas",
  glutes: "pernas",
  calves: "pernas",
  ombros: "ombros",
  shoulders: "ombros",
  biceps: "biceps",
  triceps: "triceps",
  core: "core",
  abs: "core",
  cardio: "cardio",
};

const EQUIP_ALIASES: Record<string, CoverageEquipment> = {
  casa: "casa",
  academia: "academia",
  ambos: "ambos",
  barbell: "academia",
  dumbbell: "academia",
  machine: "academia",
  cable: "academia",
  "body weight": "casa",
  bodyweight: "casa",
  band: "casa",
};

export function normalizeMuscle(value: string): CoverageMuscle | null {
  const key = normalizeCatalogName(value);
  return MUSCLE_ALIASES[key] ?? null;
}

export function normalizeEquipment(value: string): CoverageEquipment | null {
  const key = normalizeCatalogName(value);
  return EQUIP_ALIASES[key] ?? null;
}

export function matchLibraryRow(
  targetNamePt: string,
  library: LibraryIndexRow[],
): LibraryIndexRow | null {
  const needle = normalizeCatalogName(targetNamePt);
  if (!needle) return null;
  return (
    library.find((row) => normalizeCatalogName(row.name) === needle) ??
    library.find((row) => normalizeCatalogName(row.id.replace(/-/g, " ")) === needle) ??
    null
  );
}

export function applyCoverageStatus(
  taxonomy: CoverageEntry[],
  library: LibraryIndexRow[],
): CoverageEntry[] {
  return taxonomy.map((entry) => {
    if (entry.status === "deferred") return entry;
    const hit = matchLibraryRow(entry.targetNamePt, library);
    if (!hit) {
      return { ...entry, status: "missing" as const };
    }
    return {
      ...entry,
      status: "covered" as const,
      soldiersId: hit.id,
    };
  });
}
