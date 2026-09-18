/**
 * Version / updated_at conflict helpers for multi-device sync.
 * Avoids blind last-write-wins for important entities.
 */

export type VersionedRemote = {
  version?: number | null;
  updated_at?: string | null;
};

export type IncomingVersion = {
  version?: number | null;
  clientUpdatedAt?: string | null;
};

/** Accept write when incoming is same-or-newer by version, else by clientUpdatedAt vs remote updated_at. */
export function shouldAcceptWrite(remote: VersionedRemote | null | undefined, incoming: IncomingVersion): boolean {
  if (!remote) return true;
  const remoteVersion = Number(remote.version ?? 0);
  const incomingVersion = Number(incoming.version ?? 0);
  if (incomingVersion > 0 && remoteVersion > 0) {
    return incomingVersion >= remoteVersion;
  }
  const remoteAt = remote.updated_at ? Date.parse(String(remote.updated_at)) : 0;
  const incomingAt = incoming.clientUpdatedAt ? Date.parse(String(incoming.clientUpdatedAt)) : Date.now();
  if (!remoteAt) return true;
  return incomingAt >= remoteAt;
}

export function nextVersion(remoteVersion: number | null | undefined): number {
  return Math.max(1, Number(remoteVersion ?? 0) + 1);
}
