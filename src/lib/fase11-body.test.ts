import { describe, expect, it } from "vitest";
import { sanitizeMetadata } from "@/lib/events/normalize";
import {
  buildProgressPhotoPath,
  DEFAULT_PHOTO_VISIBILITY,
  evolutionDeltas,
  isPrivateProgressPhotoPath,
  isValidProgressPhotoPath,
  mergeMeasurementsByDate,
  mergeProgressPhotos,
  measurementsLoggedPayload,
  photosEligibleForCard,
  shouldIncludePhotosInEvolutionCard,
} from "@/lib/progress/body";
import type { BodyMeasurementEntry, ProgressPhotoEntry } from "@/lib/types";

function m(partial: Partial<BodyMeasurementEntry> & { date: string }): BodyMeasurementEntry {
  return {
    waistCm: null,
    armCm: null,
    chestCm: null,
    hipCm: null,
    thighCm: null,
    ...partial,
  };
}

function photo(partial: Partial<ProgressPhotoEntry> & { id: string; takenOn: string }): ProgressPhotoEntry {
  const pose = partial.pose ?? "front";
  return {
    pose,
    storagePath:
      partial.storagePath ??
      buildProgressPhotoPath({
        authUserId: "auth-user-1",
        takenOn: partial.takenOn,
        pose,
        id: partial.id,
      }),
    visibility: partial.visibility ?? DEFAULT_PHOTO_VISIBILITY,
    ...partial,
  };
}

describe("Fase 11 measurements merge", () => {
  it("keeps one row per day and lets local win", () => {
    const remote = [m({ date: "2026-09-01", waistCm: 80 }), m({ date: "2026-09-02", armCm: 35 })];
    const local = [m({ date: "2026-09-02", armCm: 36, chestCm: 100 })];
    const merged = mergeMeasurementsByDate(remote, local);
    expect(merged).toHaveLength(2);
    expect(merged.find((x) => x.date === "2026-09-02")).toMatchObject({
      armCm: 36,
      chestCm: 100,
    });
  });
});

describe("Fase 11 photo privacy", () => {
  it("defaults visibility to private", () => {
    expect(DEFAULT_PHOTO_VISIBILITY).toBe("private");
    expect(photo({ id: "p1", takenOn: "2026-09-01" }).visibility).toBe("private");
  });

  it("rejects checkins bucket paths", () => {
    expect(isPrivateProgressPhotoPath("checkins/device/1.jpg")).toBe(false);
    expect(isValidProgressPhotoPath("checkins/device/1.jpg")).toBe(false);
    expect(isValidProgressPhotoPath("auth-user-1/checkins/front-x.jpg")).toBe(false);
  });

  it("accepts private progress-photos path shape", () => {
    const path = buildProgressPhotoPath({
      authUserId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      takenOn: "2026-09-19",
      pose: "side",
      id: "photo-1",
    });
    expect(path.startsWith("checkins")).toBe(false);
    expect(isValidProgressPhotoPath(path, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(true);
  });

  it("merges photos by date+pose with local winning", () => {
    const remote = [photo({ id: "old", takenOn: "2026-09-01", pose: "front" })];
    const local = [photo({ id: "new", takenOn: "2026-09-01", pose: "front" })];
    const merged = mergeProgressPhotos(remote, local);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("new");
  });
});

describe("Fase 11 evolution card photos", () => {
  it("keeps numbers-only card when toggle is off", () => {
    const photos = [
      photo({ id: "a", takenOn: "2026-09-01", visibility: "card" }),
      photo({ id: "b", takenOn: "2026-09-10", visibility: "card" }),
    ];
    expect(
      shouldIncludePhotosInEvolutionCard({ includePhotosToggle: false, photos }),
    ).toBe(false);
  });

  it("includes photos only when toggle is on and visibility is card/feed", () => {
    const privateOnly = [photo({ id: "a", takenOn: "2026-09-01", visibility: "private" })];
    expect(
      shouldIncludePhotosInEvolutionCard({ includePhotosToggle: true, photos: privateOnly }),
    ).toBe(false);
    const eligible = [photo({ id: "a", takenOn: "2026-09-01", visibility: "card" })];
    expect(photosEligibleForCard(eligible)).toHaveLength(1);
    expect(
      shouldIncludePhotosInEvolutionCard({ includePhotosToggle: true, photos: eligible }),
    ).toBe(true);
  });

  it("computes weight and waist deltas", () => {
    const d = evolutionDeltas(
      [
        { date: "2026-09-01", weightKg: 82 },
        { date: "2026-09-19", weightKg: 80 },
      ],
      [m({ date: "2026-09-01", waistCm: 84 }), m({ date: "2026-09-19", waistCm: 80 })],
    );
    expect(d.weightKg).toBe(-2);
    expect(d.waistCm).toBe(-4);
  });
});

describe("Fase 11 analytics payload", () => {
  it("logs measurements without cm values", () => {
    const payload = measurementsLoggedPayload("2026-09-19");
    expect(payload).toEqual({ logged: true, date: "2026-09-19" });
    expect("waistCm" in payload).toBe(false);
  });

  it("strips measurement keys from event metadata", () => {
    const clean = sanitizeMetadata({
      logged: true,
      waist_cm: 80,
      armCm: 35,
      storage_path: "auth/2026-09-19/front-x.jpg",
    });
    expect(clean["logged"]).toBe(true);
    expect(clean["waist_cm"]).toBeUndefined();
    expect(clean["armCm"]).toBeUndefined();
    expect(clean["storage_path"]).toBeUndefined();
  });
});
