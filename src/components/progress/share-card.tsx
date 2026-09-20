import { toBlob, toPng } from "html-to-image";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { SoldiersLogo as BrandLockup } from "@/components/soldiers-logo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { challengeById } from "@/data/challenges";
import { exerciseById } from "@/data/exercises";
import { streak } from "@/lib/engine/dimensions";
import { buildProofOfPerformance } from "@/lib/engine/proof-of-performance";
import {
  SHARE_CARD_EYEBROW,
  SHARE_KIND_LABEL,
  SHARE_STREAK_LABEL,
} from "@/lib/ui/platform-copy";
import {
  datesForPose,
  evolutionDeltas,
  formatCmDelta,
  formatKgDelta,
  photoForPoseOnDate,
  photosEligibleForCard,
  shouldIncludePhotosInEvolutionCard,
} from "@/lib/progress/body";
import { signedProgressPhotoUrl, visibilityAfterCardPublish } from "@/lib/progress/photos";
import { updateProgressPhotoVisibilityFn } from "@/lib/progress/photos.functions";
import { challengeProgress, publishEvent, uploadCheckinImage, type ChallengeProgressOpts } from "@/lib/social";
import { getDeviceId } from "@/lib/sync";
import { currentPersonalRecords } from "@/lib/training/prs";
import type { AppState, SessionLog } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ShareCardKind = "treino" | "pr" | "streak" | "desafio" | "evolucao" | "prova";

export const KIND_LABEL: Record<ShareCardKind, string> = { ...SHARE_KIND_LABEL };

export function ShareCard({
  athleteName,
  title,
  volumeKg,
  durationMin,
  streak: streakDays,
  score,
  dateLabel,
  xp,
  prCount,
  rankLabel,
}: {
  athleteName: string;
  title: string;
  volumeKg: number;
  durationMin: number;
  streak: number;
  score: number;
  dateLabel: string;
  xp?: number;
  prCount?: number;
  rankLabel?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] bg-[#0A0A0A] p-5 text-white">
      <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[#E10600]/25 blur-2xl" />
      <BrandLockup />
      <p className="mt-4 text-[0.65rem] uppercase tracking-[0.28em] text-white/55">{SHARE_CARD_EYEBROW}</p>
      <h3 className="mt-1 font-display text-2xl uppercase italic">{athleteName}</h3>
      <p className="text-sm text-white/70">{title}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <Stat label="Volume" value={`${Math.round(volumeKg)} kg`} />
        <Stat label="Tempo" value={`${durationMin} min`} />
        <Stat label={SHARE_STREAK_LABEL} value={`${streakDays}d`} />
        <Stat label="Score" value={`${score}`} />
        {xp != null ? <Stat label="XP" value={`+${xp}`} /> : null}
        {prCount != null ? <Stat label="PRs" value={`${prCount}`} /> : null}
      </div>
      {rankLabel ? <p className="mt-2 text-center text-xs text-white/60">{rankLabel}</p> : null}
      <p className="mt-4 text-center text-[0.65rem] uppercase tracking-[0.2em] text-white/40">{dateLabel}</p>
    </div>
  );
}

export function PeriodShareCard({
  athleteName,
  title,
  sessions,
  volumeKg,
  prCount,
  consistencyPct,
}: {
  athleteName: string;
  title: string;
  sessions: number;
  volumeKg: number;
  prCount: number;
  consistencyPct: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={ref}>
        <div className="relative overflow-hidden rounded-[1.6rem] bg-[#0A0A0A] p-5 text-white">
          <BrandLockup />
          <p className="mt-4 text-[0.65rem] uppercase tracking-[0.28em] text-white/55">{title}</p>
          <h3 className="mt-1 font-display text-2xl uppercase italic">{athleteName}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <Stat label="Treinos" value={`${sessions}`} />
            <Stat label="Volume" value={`${Math.round(volumeKg)} kg`} />
            <Stat label="PRs" value={`${prCount}`} />
            <Stat label="Consistência" value={`${consistencyPct}%`} />
          </div>
        </div>
      </div>
      <ShareButtons cardRef={ref} fileName={`soldiers-${title}.png`} />
    </div>
  );
}

export function ShareCardActions({
  athleteName,
  session,
  streak: streakDays,
  score,
  xp,
  prCount,
  rankLabel,
}: {
  athleteName: string;
  session: SessionLog;
  streak: number;
  score: number;
  xp?: number;
  prCount?: number;
  rankLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={ref}>
        <ShareCard
          athleteName={athleteName}
          title={session.title}
          volumeKg={session.volumeKg}
          durationMin={session.durationMin}
          streak={streakDays}
          score={score}
          dateLabel={new Date(session.date).toLocaleDateString("pt-BR")}
          {...(xp != null ? { xp } : {})}
          {...(prCount != null ? { prCount } : {})}
          {...(rankLabel ? { rankLabel } : {})}
        />
      </div>
      <ShareButtons cardRef={ref} fileName="soldiers-treino.png" />
    </div>
  );
}

export function ShareCardPicker({
  state,
  session,
  defaultKind = "treino",
  score = 0,
  xp,
  prCount,
  rankLabel,
}: {
  state: AppState;
  session?: SessionLog | null;
  defaultKind?: ShareCardKind;
  score?: number;
  xp?: number;
  prCount?: number;
  rankLabel?: string;
}) {
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<ShareCardKind>(defaultKind);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<{ before?: string; after?: string }>({});
  const ref = useRef<HTMLDivElement>(null);
  const name = state.profile?.name ?? "Soldado";
  const latest = session ?? [...state.sessions].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const currentStreak = streak(state.sessions, { freezeUsedDates: state.freezeUsedDates });
  const prs = currentPersonalRecords(state.sessions);
  const topPr = prs[0];
  const activeChallenge = (state.challenges ?? [])
    .map((id) => {
      const c = challengeById(id);
      if (!c) return null;
      const progressOpts: ChallengeProgressOpts = {
        activityLogs: state.activityLogs,
      };
      const baseline = state.challengeBaselines?.[id];
      if (baseline != null) progressOpts.baseline = baseline;
      const personalTarget = state.challengePersonalTargets?.[id];
      if (personalTarget != null) progressOpts.personalTarget = personalTarget;
      const progress = challengeProgress(c, state.sessions, progressOpts);
      return { challenge: c, progress };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))[0];
  const deltas = evolutionDeltas(state.weights ?? [], state.measurements ?? []);
  const eligiblePhotos = photosEligibleForCard(state.progressPhotos ?? []);
  const showPhotos = shouldIncludePhotosInEvolutionCard({
    includePhotosToggle: includePhotos,
    photos: eligiblePhotos,
  });

  useEffect(() => {
    if (!includePhotos) {
      setPhotoUrls({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const pose = (["front", "side", "back"] as const).find((p) => datesForPose(eligiblePhotos, p).length >= 2);
      if (!pose) return;
      const dates = datesForPose(eligiblePhotos, pose);
      const first = photoForPoseOnDate(eligiblePhotos, pose, dates[0] ?? "");
      const last = photoForPoseOnDate(eligiblePhotos, pose, dates[dates.length - 1] ?? "");
      const before = first ? await signedProgressPhotoUrl(first.storagePath) : null;
      const after = last ? await signedProgressPhotoUrl(last.storagePath) : null;
      if (cancelled) return;
      setPhotoUrls({
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [includePhotos, eligiblePhotos.map((p) => p.id).join(",")]);

  const kinds = useMemo(() => {
    const all: ShareCardKind[] = ["treino", "pr", "streak", "desafio", "evolucao", "prova"];
    return all.filter((k) => {
      if (k === "treino") return Boolean(latest);
      if (k === "pr") return Boolean(topPr);
      if (k === "desafio") return Boolean(activeChallenge);
      return true;
    });
  }, [latest, topPr, activeChallenge]);
  const proof = buildProofOfPerformance(state);

  async function publishToFeed() {
    const node = ref.current;
    if (!node) return;
    setPublishing(true);
    try {
      const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true });
      if (!blob) throw new Error("blob");
      const file = new File([blob], `soldiers-${kind}.png`, { type: "image/png" });
      const imageUrl = await uploadCheckinImage(getDeviceId(), file);
      await publishEvent(getDeviceId(), name, "proof", {
        cardKind: kind,
        imageUrl,
        composed: true,
      });
      if (kind === "evolucao" && showPhotos) {
        for (const photo of eligiblePhotos) {
          const next = visibilityAfterCardPublish(photo.visibility);
          if (next !== photo.visibility) {
            await updateProgressPhotoVisibilityFn({
              data: { deviceId: getDeviceId(), photoId: photo.id, visibility: next },
            }).catch(() => undefined);
          }
        }
      }
      toast.success("Card publicado no feed (PNG composto).");
    } catch {
      toast.error("Não foi possível publicar no feed.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <motion.div
      className="space-y-3"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-wrap gap-1">
        {kinds.map((k) => (
          <Button key={k} size="sm" variant={kind === k ? "default" : "secondary"} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </Button>
        ))}
      </div>

      {kind === "evolucao" ? (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm">
          <span>Incluir fotos no card</span>
          <Switch
            checked={includePhotos}
            onCheckedChange={setIncludePhotos}
            disabled={!eligiblePhotos.length}
          />
        </label>
      ) : null}
      {kind === "evolucao" && includePhotos && !eligiblePhotos.length ? (
        <p className="text-xs text-muted-foreground">Libere uma foto no card em Medidas e fotos.</p>
      ) : null}

      <div ref={ref}>
        {kind === "treino" && latest ? (
          <ShareCard
            athleteName={name}
            title={latest.title}
            volumeKg={latest.volumeKg}
            durationMin={latest.durationMin}
            streak={currentStreak}
            score={score}
            dateLabel={new Date(latest.date).toLocaleDateString("pt-BR")}
            {...(xp != null ? { xp } : {})}
            {...(prCount != null ? { prCount } : {})}
            {...(rankLabel ? { rankLabel } : {})}
          />
        ) : null}
        {kind === "pr" && topPr ? (
          <KindCard
            eyebrow="Recorde pessoal"
            name={name}
            title={topPr.label}
            stats={[
              ["Exercício", exerciseById(topPr.exerciseId ?? "")?.name ?? "Sessão"],
              ["Valor", `${topPr.value}`],
              ["Tipo", topPr.prType.replace("_", " ")],
            ]}
          />
        ) : null}
        {kind === "streak" ? (
          <KindCard
            eyebrow="Consistência"
            name={name}
            title={`${currentStreak} dias seguidos`}
            stats={[[SHARE_STREAK_LABEL, `${currentStreak}d`]]}
          />
        ) : null}
        {kind === "desafio" && activeChallenge ? (
          <KindCard
            eyebrow="Desafio"
            name={name}
            title={activeChallenge.challenge.title}
            stats={[["Progresso", `${Math.round(activeChallenge.progress.pct)}%`]]}
          />
        ) : null}
        {kind === "prova" ? (
          <KindCard
            eyebrow="Prova de desempenho"
            name={name}
            title={`${proof.periodDays} dias · ${proof.status === "verified" ? "Verificado" : "Auto-relatado"}`}
            stats={[
              ["Score", `${proof.scoreDelta > 0 ? "+" : ""}${proof.scoreDelta}`],
              ["Volume", `${proof.volumeDeltaPct > 0 ? "+" : ""}${proof.volumeDeltaPct}%`],
            ]}
          />
        ) : null}
        {kind === "evolucao" ? (
          <EvolutionCard
            name={name}
            weight={formatKgDelta(deltas.weightKg)}
            waist={formatCmDelta(deltas.waistCm)}
            extras={[
              ["Braço", formatCmDelta(deltas.armCm)],
              ["Peito", formatCmDelta(deltas.chestCm)],
              ["Quadril", formatCmDelta(deltas.hipCm)],
              ["Coxa", formatCmDelta(deltas.thighCm)],
            ]}
            showPhotos={showPhotos}
            {...(photoUrls.before ? { beforeUrl: photoUrls.before } : {})}
            {...(photoUrls.after ? { afterUrl: photoUrls.after } : {})}
          />
        ) : null}
      </div>

      <ShareButtons cardRef={ref} fileName={`soldiers-${kind}.png`} />
      <Button variant="outline" className="h-10 w-full" disabled={publishing} onClick={() => void publishToFeed()}>
        {publishing ? "Publicando…" : "Publicar no feed"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Publicar sobe só o PNG composto. Fotos de corpo originais ficam no bucket privado.
      </p>
    </motion.div>
  );
}

function KindCard({
  eyebrow,
  name,
  title,
  stats,
}: {
  eyebrow: string;
  name: string;
  title: string;
  stats: Array<[string, string]>;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] bg-[#0A0A0A] p-5 text-white">
      <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[#E10600]/25 blur-2xl" />
      <BrandLockup />
      <p className="mt-4 text-[0.65rem] uppercase tracking-[0.28em] text-white/55">{eyebrow}</p>
      <h3 className="mt-1 font-display text-2xl uppercase italic">{name}</h3>
      <p className="text-sm text-white/80">{title}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        {stats.map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

function EvolutionCard({
  name,
  weight,
  waist,
  extras,
  showPhotos,
  beforeUrl,
  afterUrl,
}: {
  name: string;
  weight: string | null;
  waist: string | null;
  extras: Array<[string, string | null]>;
  showPhotos: boolean;
  beforeUrl?: string;
  afterUrl?: string;
}) {
  const extraRows = extras.filter(([, v]) => v);
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] bg-[#0A0A0A] p-5 text-white">
      <BrandLockup />
      <p className="mt-4 text-[0.65rem] uppercase tracking-[0.28em] text-white/55">Evolução</p>
      <h3 className="mt-1 font-display text-2xl uppercase italic">{name}</h3>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <Stat label="Peso" value={weight ?? "—"} />
        <Stat label="Cintura" value={waist ?? "—"} />
        {extraRows.map(([label, value]) => (
          <Stat key={label} label={label} value={value ?? "—"} />
        ))}
      </div>
      {showPhotos && beforeUrl && afterUrl ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <img src={beforeUrl} alt="Antes" className="aspect-[3/4] w-full rounded-xl object-cover" />
          <img src={afterUrl} alt="Agora" className="aspect-[3/4] w-full rounded-xl object-cover" />
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 py-2">
      <p className="text-[0.6rem] uppercase tracking-wider text-white/45">{label}</p>
      <p className="font-display text-lg italic">{value}</p>
    </div>
  );
}

function ShareButtons({ cardRef, fileName }: { cardRef: RefObject<HTMLDivElement | null>; fileName: string }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    const node = cardRef.current;
    if (!node) return;
    setBusy(true);
    try {
      const url = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
    } catch {
      toast.error("Não foi possível gerar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const node = cardRef.current;
    if (!node) return;
    setBusy(true);
    try {
      const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true });
      if (!blob) throw new Error("blob");
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (nav.share && navigator.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Soldiers Training" });
      } else {
        await download();
      }
    } catch {
      toast.error("Compartilhamento indisponível neste aparelho.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("mt-3 grid grid-cols-2 gap-2")}>
      <Button variant="secondary" disabled={busy} onClick={() => void download()}>
        Baixar PNG
      </Button>
      <Button disabled={busy} onClick={() => void share()}>
        Compartilhar
      </Button>
    </div>
  );
}
