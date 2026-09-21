import { Image, Save, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EXERCISE_LIBRARY } from "@/data/exercise-library";
import type { CmsState } from "@/lib/cms";
import type { MealPreset } from "@/data/meal-presets";
import { allowedStatusTransitions, isSoldiersOwnedUrl } from "@/lib/soldiers-media-governance";
import type { SoldiersMediaAsset, SoldiersMediaStatus } from "@/lib/soldiers-media-types";

const STATUS_LABEL: Record<SoldiersMediaStatus, string> = {
  draft: "Draft",
  generated: "Generated",
  qa: "QA",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
};

function badgeVariant(
  status: SoldiersMediaStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "published") return "default";
  if (status === "rejected") return "destructive";
  if (status === "qa" || status === "approved") return "secondary";
  return "outline";
}

function packKey(kind: string, entityId: string) {
  return `${kind}:${entityId}`;
}

export function MediaTab({
  cms,
  setCms,
  meals,
  packages,
  saving,
  statusBusy,
  onSave,
  onStatusChange,
}: {
  cms: CmsState;
  setCms: (updater: (s: CmsState) => CmsState) => void;
  meals: MealPreset[];
  packages: SoldiersMediaAsset[];
  saving: boolean;
  statusBusy: boolean;
  onSave: () => void;
  onStatusChange: (pack: SoldiersMediaAsset, status: SoldiersMediaStatus) => void;
}) {
  const byKey = new Map(packages.map((p) => [packKey(p.kind, p.entityId), p]));

  return (
    <div className="space-y-4">
      <Button
        className="h-11 w-full gap-2 font-bold uppercase tracking-wide"
        onClick={onSave}
        disabled={saving}
      >
        <Save className="size-4" /> {saving ? "Salvando…" : "Salvar mídia"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Produção: package Soldiers published. CMS autorizado só preenche lacuna e precisa ser URL
        Soldiers-owned.
      </p>
      {EXERCISE_LIBRARY.map((ex) => {
        const mediaId = ex.mediaId || ex.id;
        const pack = byKey.get(packKey("exercise", mediaId));
        const status = pack?.status ?? "draft";
        const cmsUrl = cms.exerciseMedia[mediaId] ?? "";
        const canAuthorize = isSoldiersOwnedUrl(cmsUrl);
        const authorized = Boolean(cms.exerciseMediaAuthorized[mediaId]) && canAuthorize;
        return (
          <div key={ex.id} className="surface-glass space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Video className="size-4 text-primary" />
                <p className="text-sm font-semibold">{ex.name}</p>
              </div>
              <Badge variant={badgeVariant(status)}>{STATUS_LABEL[status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              mediaId {mediaId}
              {pack?.version ? ` · ${pack.version}` : ""}
              {pack?.source === "soldiers" ? " · soldiers-owned" : ""}
            </p>
            {pack ? (
              <div className="flex flex-wrap gap-2">
                {allowedStatusTransitions(status).map((next) => (
                  <Button
                    key={next}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={statusBusy}
                    onClick={() => onStatusChange(pack, next)}
                  >
                    {STATUS_LABEL[next]}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem package persistido — manifesto local.
              </p>
            )}
            <Label className="text-xs text-muted-foreground">CMS override</Label>
            <Input
              value={cmsUrl}
              placeholder="/soldiers-media/v1/exercise/…"
              onChange={(e) =>
                setCms((s) => ({
                  ...s,
                  exerciseMedia: { ...s.exerciseMedia, [mediaId]: e.target.value },
                  exerciseMediaAuthorized: {
                    ...s.exerciseMediaAuthorized,
                    [mediaId]:
                      Boolean(s.exerciseMediaAuthorized[mediaId]) &&
                      isSoldiersOwnedUrl(e.target.value),
                  },
                }))
              }
            />
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Autorizar CMS na produção</Label>
              <Switch
                checked={authorized}
                disabled={!canAuthorize}
                onCheckedChange={(checked) =>
                  setCms((s) => ({
                    ...s,
                    exerciseMediaAuthorized: {
                      ...s.exerciseMediaAuthorized,
                      [mediaId]: checked && isSoldiersOwnedUrl(s.exerciseMedia[mediaId] ?? ""),
                    },
                  }))
                }
              />
            </div>
            {!canAuthorize && cmsUrl ? (
              <p className="text-xs text-destructive">URL externa não pode ser Soldiers-owned.</p>
            ) : null}
          </div>
        );
      })}
      {meals.map((m) => {
        const cmsUrl = cms.mealImages[m.id] ?? "";
        const pack = byKey.get(packKey("meal", m.id));
        const status = pack?.status ?? "draft";
        const canAuthorize = isSoldiersOwnedUrl(cmsUrl);
        const authorized = Boolean(cms.mealImagesAuthorized[m.id]) && canAuthorize;
        return (
          <div key={m.id} className="surface-glass space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Image className="size-4 text-primary" />
                <p className="text-sm font-semibold">{m.label}</p>
              </div>
              <Badge variant={badgeVariant(status)}>{STATUS_LABEL[status]}</Badge>
            </div>
            <Input
              value={cmsUrl}
              placeholder="/soldiers-media/v1/meal/…"
              onChange={(e) =>
                setCms((s) => ({
                  ...s,
                  mealImages: { ...s.mealImages, [m.id]: e.target.value },
                  mealImagesAuthorized: {
                    ...s.mealImagesAuthorized,
                    [m.id]:
                      Boolean(s.mealImagesAuthorized[m.id]) && isSoldiersOwnedUrl(e.target.value),
                  },
                }))
              }
            />
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Autorizar CMS na produção</Label>
              <Switch
                checked={authorized}
                disabled={!canAuthorize}
                onCheckedChange={(checked) =>
                  setCms((s) => ({
                    ...s,
                    mealImagesAuthorized: {
                      ...s.mealImagesAuthorized,
                      [m.id]: checked && isSoldiersOwnedUrl(s.mealImages[m.id] ?? ""),
                    },
                  }))
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
