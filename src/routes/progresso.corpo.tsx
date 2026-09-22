import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, EmptyState, LoadingPulse } from "@/components/app-shell";
import { ComparisonSlider } from "@/components/progress/comparison-slider";
import { ShareCardPicker } from "@/components/progress/share-card";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BODY_SITES,
  datesForPose,
  emptyMeasurement,
  parseCm,
  PHOTO_POSES,
  photoForPoseOnDate,
  POSE_LABEL,
  type BodySiteKey,
} from "@/lib/progress/body";
import {
  deleteProgressPhotoFile,
  signedProgressPhotoUrl,
  uploadProgressPhotoFile,
} from "@/lib/progress/photos";
import {
  deleteProgressPhotoFn,
  saveProgressPhotoFn,
  updateProgressPhotoVisibilityFn,
} from "@/lib/progress/photos.functions";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import { todayKey, type PhotoPose, type PhotoVisibility } from "@/lib/types";
import {
  EMPTY_COMPARE_BODY,
  EMPTY_COMPARE_TITLE,
  EMPTY_PHOTOS_BODY,
  EMPTY_PHOTOS_TITLE,
} from "@/lib/ui/platform-copy";

export const Route = createFileRoute("/progresso/corpo")({
  head: () => ({
    meta: [
      { title: "Medidas e fotos — Soldiers Training" },
      {
        name: "description",
        content: "Cintura, braço, peito, quadril, coxa e fotos privadas de frente, lado e costas.",
      },
    ],
  }),
  component: CorpoPage,
});

function CorpoPage() {
  const {
    state,
    hydrated,
    addMeasurements,
    upsertProgressPhoto,
    removeProgressPhoto,
    setProgressPhotoVisibility,
  } = useStore();
  const today = todayKey();
  const measurements = state.measurements ?? [];
  const photos = state.progressPhotos ?? [];
  const todayRow = measurements.find((m) => m.date === today) ?? emptyMeasurement(today);

  const [form, setForm] = useState(todayRow);
  const [pose, setPose] = useState<PhotoPose>("front");
  const [busyPose, setBusyPose] = useState<PhotoPose | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setForm(todayRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when today's saved row changes
  }, [todayRow.date, todayRow.waistCm, todayRow.armCm, todayRow.chestCm, todayRow.hipCm, todayRow.thighCm]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const photo of photos) {
        const url = await signedProgressPhotoUrl(photo.storagePath);
        if (url) next[photo.id] = url;
      }
      if (!cancelled) setSigned(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  const poseDates = useMemo(() => datesForPose(photos, pose), [photos, pose]);
  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate] = useState("");

  useEffect(() => {
    if (!poseDates.length) {
      setBeforeDate("");
      setAfterDate("");
      return;
    }
    setBeforeDate(poseDates[0] ?? "");
    setAfterDate(poseDates[poseDates.length - 1] ?? "");
  }, [pose, poseDates.join("|")]);

  const beforePhoto = photoForPoseOnDate(photos, pose, beforeDate);
  const afterPhoto = photoForPoseOnDate(photos, pose, afterDate);
  const beforeUrl = beforePhoto ? signed[beforePhoto.id] : undefined;
  const afterUrl = afterPhoto ? signed[afterPhoto.id] : undefined;

  if (!hydrated || !state.profile) {
    return (
      <AppShell title="Medidas e fotos">
        <LoadingPulse />
      </AppShell>
    );
  }

  function saveForm() {
    addMeasurements({
      date: today,
      waistCm: form.waistCm,
      armCm: form.armCm,
      chestCm: form.chestCm,
      hipCm: form.hipCm,
      thighCm: form.thighCm,
    });
    toast.success("Medidas do dia salvas.");
  }

  async function onUpload(nextPose: PhotoPose, file: File | undefined) {
    if (!file) return;
    setBusyPose(nextPose);
    const uploaded = await uploadProgressPhotoFile({ file, takenOn: today, pose: nextPose });
    if ("error" in uploaded) {
      toast.error(uploaded.error);
      setBusyPose(null);
      return;
    }
    const saved = await saveProgressPhotoFn({
      data: {
        deviceId: getDeviceId(),
        id: uploaded.photo.id,
        takenOn: uploaded.photo.takenOn,
        pose: uploaded.photo.pose,
        storagePath: uploaded.photo.storagePath,
        visibility: uploaded.photo.visibility,
      },
    }).catch(() => ({ ok: false as const }));
    if (!saved.ok) {
      toast.error("Foto enviada, mas o metadado não sincronizou. Tente de novo.");
      setBusyPose(null);
      return;
    }
    upsertProgressPhoto(saved.photo ?? uploaded.photo);
    toast.success(`${POSE_LABEL[nextPose]} salva (privada).`);
    setBusyPose(null);
  }

  async function onDelete(id: string, storagePath: string) {
    await deleteProgressPhotoFile(storagePath);
    await deleteProgressPhotoFn({ data: { deviceId: getDeviceId(), photoId: id } }).catch(() => undefined);
    removeProgressPhoto(id);
    toast.success("Foto apagada.");
  }

  async function onVisibility(id: string, visibility: PhotoVisibility) {
    setProgressPhotoVisibility(id, visibility);
    await updateProgressPhotoVisibilityFn({
      data: { deviceId: getDeviceId(), photoId: id, visibility },
    }).catch(() => undefined);
  }

  const history = [...measurements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  return (
    <AppShell title="Medidas e fotos" subtitle="Privado no app · feed só se você publicar o card">
      <Link to="/progresso" className="mb-4 inline-block text-xs font-semibold text-primary">
        ← Progresso
      </Link>

      <section className="surface-glass mb-4 space-y-3 p-4">
        <p className="text-sm font-semibold">Medidas de hoje</p>
        {state.weights[state.weights.length - 1] ? (
          <p className="text-xs text-muted-foreground">
            Peso atual {state.weights[state.weights.length - 1]!.weightKg} kg (registrado em Hoje). Circunferências abaixo.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Peso em Hoje · circunferências e fotos aqui.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {BODY_SITES.map((site) => (
            <div key={site.key}>
              <Label htmlFor={site.key}>{site.label}</Label>
              <Input
                id={site.key}
                inputMode="decimal"
                placeholder="cm"
                value={form[site.key] == null || Number.isNaN(form[site.key] as number) ? "" : String(form[site.key])}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [site.key]: e.target.value.trim() === "" ? null : parseCm(e.target.value),
                  }))
                }
              />
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={saveForm}>
          Salvar medidas
        </Button>
      </section>

      <section className="surface-glass mb-4 p-4">
        <p className="text-sm font-semibold">Histórico</p>
        {history.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((row) => (
              <li key={row.date} className="flex justify-between gap-2 border-b border-white/5 pb-2">
                <span className="text-muted-foreground">{fmtDate(row.date)}</span>
                <span className="text-right text-xs">
                  {BODY_SITES.map((s) => (row[s.key] != null ? `${s.label} ${row[s.key]}` : null))
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Ainda sem medidas. Registre o primeiro dia acima.</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {BODY_SITES.map((site) => (
            <SiteSpark key={site.key} label={site.label} values={sparkValues(measurements, site.key)} />
          ))}
        </div>
      </section>

      <section className="surface-glass mb-4 space-y-3 p-4">
        <p className="text-sm font-semibold">Fotos frente / lado / costas</p>
        <p className="text-xs text-muted-foreground">
          Bucket privado, URL assinada. O feed nunca recebe o arquivo original.
        </p>
        {!photos.length ? (
          <EmptyState
            className="border-0 bg-transparent px-0 py-6 shadow-none"
            variant="progresso"
            title={EMPTY_PHOTOS_TITLE}
            description={EMPTY_PHOTOS_BODY}
            action={
              <Button
                type="button"
                className="w-full"
                onClick={() => document.getElementById("photo-front")?.click()}
              >
                Tirar frente
              </Button>
            }
          />
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          {PHOTO_POSES.map((p) => {
            const existing = photoForPoseOnDate(photos, p, today);
            const url = existing ? signed[existing.id] : undefined;
            return (
              <label key={p} className="block cursor-pointer">
                <div className="aspect-[3/4] overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/40">
                  {url ? (
                    <img src={url} alt={POSE_LABEL[p]} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-muted-foreground">
                      {busyPose === p ? "Enviando…" : `Tirar ${POSE_LABEL[p].toLowerCase()}`}
                    </div>
                  )}
                </div>
                <input
                  id={`photo-${p}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busyPose !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void onUpload(p, file);
                    e.target.value = "";
                  }}
                />
              </label>
            );
          })}
        </div>
        {photos.length ? (
          <ul className="space-y-2">
            {[...photos].sort((a, b) => b.takenOn.localeCompare(a.takenOn)).map((photo) => (
              <li key={photo.id} className="flex items-center gap-2 rounded-xl border border-white/10 p-2">
                {signed[photo.id] ? (
                  <img src={signed[photo.id]} alt="" className="h-12 w-9 rounded object-cover" />
                ) : (
                  <div className="h-12 w-9 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {POSE_LABEL[photo.pose]} · {fmtDate(photo.takenOn)}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground">{photo.visibility}</p>
                </div>
                <Button
                  size="sm"
                  variant={photo.visibility === "private" ? "secondary" : "default"}
                  onClick={() => void onVisibility(photo.id, photo.visibility === "private" ? "card" : "private")}
                >
                  {photo.visibility === "private" ? "Liberar no card" : "Privada"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onDelete(photo.id, photo.storagePath)}>
                  Apagar
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="surface-glass mb-8 space-y-3 p-4">
        <p className="text-sm font-semibold">Antes / agora</p>
        <div className="flex gap-2">
          {PHOTO_POSES.map((p) => (
            <Button key={p} size="sm" variant={pose === p ? "default" : "secondary"} onClick={() => setPose(p)}>
              {POSE_LABEL[p]}
            </Button>
          ))}
        </div>
        {poseDates.length >= 2 && beforeUrl && afterUrl ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
                aria-label="Foto anterior"
              >
                {poseDates.map((d) => (
                  <option key={`b-${d}`} value={d}>
                    {fmtDate(d)}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={afterDate}
                onChange={(e) => setAfterDate(e.target.value)}
                aria-label="Foto atual"
              >
                {poseDates.map((d) => (
                  <option key={`a-${d}`} value={d}>
                    {fmtDate(d)}
                  </option>
                ))}
              </select>
            </div>
            <ComparisonSlider beforeUrl={beforeUrl} afterUrl={afterUrl} />
            <Button className="w-full" onClick={() => setShareOpen(true)}>
              Compartilhar evolução
            </Button>
          </>
        ) : (
          <EmptyState
            className="border-0 bg-transparent px-0 py-6 shadow-none"
            variant="progresso"
            title={EMPTY_COMPARE_TITLE}
            description={EMPTY_COMPARE_BODY}
            action={
              <Button type="button" className="w-full" onClick={() => document.getElementById("photo-front")?.click()}>
                Tirar frente
              </Button>
            }
          />
        )}
      </section>
      <SoldiersOverlay open={shareOpen} onClose={() => setShareOpen(false)} title="Compartilhar evolução">
        <ShareCardPicker state={state} defaultKind="evolucao" />
      </SoldiersOverlay>
    </AppShell>
  );
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

function sparkValues(rows: ReturnType<typeof emptyMeasurement>[], key: BodySiteKey) {
  return rows
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => r[key])
    .filter((n): n is number => n != null);
}

function SiteSpark({ label, values }: { label: string; values: number[] }) {
  if (values.length < 2) {
    return (
      <div>
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">—</p>
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 80;
      const y = 24 - ((v - min) / span) * 20;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <svg viewBox="0 0 80 28" className="h-8 w-full text-primary" aria-hidden>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}
