import { createServerFn } from "@tanstack/react-start";

function parseLeaderboard(input: unknown): { challengeId: string; deviceId: string } {
  const v = input as { challengeId?: string; deviceId?: string } | null;
  const challengeId = String(v?.challengeId ?? "").trim();
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!challengeId || deviceId.length < 8) throw new Error("Parâmetros inválidos");
  return { challengeId, deviceId };
}

function parseClubs(input: unknown): { deviceId: string } {
  const deviceId = String((input as { deviceId?: string } | null)?.deviceId ?? "").trim();
  if (deviceId.length < 8) throw new Error("Dispositivo inválido");
  return { deviceId };
}

function parseLeague(input: unknown): {
  clubId: string;
  memberDeviceIds: string[];
  yourDeviceId: string;
} {
  const v = input as {
    clubId?: string;
    memberDeviceIds?: string[];
    yourDeviceId?: string;
  } | null;
  const clubId = String(v?.clubId ?? "").trim();
  const yourDeviceId = String(v?.yourDeviceId ?? "").trim();
  if (!clubId || yourDeviceId.length < 8) throw new Error("Parâmetros inválidos");
  return {
    clubId,
    memberDeviceIds: Array.isArray(v?.memberDeviceIds) ? v!.memberDeviceIds.map(String) : [],
    yourDeviceId,
  };
}

function parseStories(input: unknown): { clubId: string; deviceId: string } {
  const v = input as { clubId?: string; deviceId?: string } | null;
  const clubId = String(v?.clubId ?? "").trim();
  const deviceId = String(v?.deviceId ?? "").trim();
  if (!clubId || deviceId.length < 8) throw new Error("Parâmetros inválidos");
  return { clubId, deviceId };
}

function parseUpload(input: unknown): {
  deviceId: string;
  bytesBase64: string;
  contentType: string;
  fileExt: string;
} {
  const v = input as {
    deviceId?: string;
    bytesBase64?: string;
    contentType?: string;
    fileExt?: string;
  } | null;
  const deviceId = String(v?.deviceId ?? "").trim();
  const bytesBase64 = String(v?.bytesBase64 ?? "");
  if (deviceId.length < 8 || !bytesBase64) throw new Error("Upload inválido");
  return {
    deviceId,
    bytesBase64,
    contentType: String(v?.contentType ?? "image/jpeg"),
    fileExt: String(v?.fileExt ?? "jpg"),
  };
}

export const fetchLeaderboardFn = createServerFn({ method: "POST" })
  .inputValidator(parseLeaderboard)
  .handler(async ({ data }) => {
    const { fetchLeaderboardServer } = await import("@/lib/social-read.server");
    return fetchLeaderboardServer(data.challengeId, data.deviceId);
  });

export const listMyClubsFn = createServerFn({ method: "POST" })
  .inputValidator(parseClubs)
  .handler(async ({ data }) => {
    const { listMyClubsServer } = await import("@/lib/social-read.server");
    return listMyClubsServer(data.deviceId);
  });

export const fetchClubLeagueFn = createServerFn({ method: "POST" })
  .inputValidator(parseLeague)
  .handler(async ({ data }) => {
    const { fetchClubLeagueServer } = await import("@/lib/social-read.server");
    return fetchClubLeagueServer(data.clubId, data.memberDeviceIds, data.yourDeviceId);
  });

export const fetchClubStoriesFn = createServerFn({ method: "POST" })
  .inputValidator(parseStories)
  .handler(async ({ data }) => {
    const { fetchClubStoriesServer } = await import("@/lib/social-read.server");
    return fetchClubStoriesServer(data.clubId, data.deviceId);
  });

export const uploadCheckinImageFn = createServerFn({ method: "POST" })
  .inputValidator(parseUpload)
  .handler(async ({ data }) => {
    const { uploadCheckinImageServer } = await import("@/lib/social-read.server");
    const url = await uploadCheckinImageServer(
      data.deviceId,
      data.bytesBase64,
      data.contentType,
      data.fileExt,
    );
    return { url };
  });
