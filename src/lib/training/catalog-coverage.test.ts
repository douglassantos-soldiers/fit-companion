import { describe, expect, it } from "vitest";
import {
  applyCoverageStatus,
  matchLibraryRow,
  normalizeCatalogName,
  normalizeEquipment,
  normalizeMuscle,
  type CoverageEntry,
  type LibraryIndexRow,
} from "@/lib/training/catalog-coverage";

const library: LibraryIndexRow[] = [
  { id: "supino-reto", name: "Supino reto", group: "peito", equipment: "academia" },
  { id: "prancha", name: "Prancha", group: "core", equipment: "ambos" },
];

describe("catalog coverage", () => {
  it("normalizes names for matching", () => {
    expect(normalizeCatalogName("  Supino  Reto ")).toBe("supino reto");
    expect(normalizeCatalogName("Tríceps na corda")).toBe("triceps na corda");
    expect(normalizeMuscle("Chest")).toBe("peito");
    expect(normalizeEquipment("dumbbell")).toBe("academia");
  });

  it("matches a Soldiers library name", () => {
    expect(matchLibraryRow("Supino reto", library)?.id).toBe("supino-reto");
    expect(matchLibraryRow("supino-reto", library)?.id).toBe("supino-reto");
  });

  it("marks taxonomy covered when the name exists", () => {
    const taxonomy: CoverageEntry[] = [
      {
        targetNamePt: "Supino reto",
        muscleHint: "peito",
        equipmentHint: "academia",
        status: "missing",
        loteHint: "1",
      },
      {
        targetNamePt: "Nordic curl",
        muscleHint: "pernas",
        equipmentHint: "ambos",
        status: "missing",
        loteHint: "2",
      },
      {
        targetNamePt: "Arranco",
        muscleHint: "pernas",
        equipmentHint: "academia",
        status: "deferred",
        loteHint: "4",
      },
    ];
    const applied = applyCoverageStatus(taxonomy, library);
    expect(applied[0]?.status).toBe("covered");
    expect(applied[0]?.soldiersId).toBe("supino-reto");
    expect(applied[1]?.status).toBe("missing");
    expect(applied[2]?.status).toBe("deferred");
  });
});
