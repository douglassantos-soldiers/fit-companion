import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import {
  BLOCKER_LABEL,
  type PrimaryBlocker,
  type Profile,
} from "@/lib/types";
import { buildNutritionProfileFromFlags, FOOD_RESTRICTION_OPTIONS } from "@/lib/engine/nutrition-profile";
import {
  enrichmentPriority,
  isActivationReady,
  isBodyValidForSave,
  isNutritionReady,
  isOnboardingFullyComplete,
  isRecoveryReady,
} from "@/lib/profile-readiness";
import { useStore } from "@/lib/store";

const BLOCKERS = Object.keys(BLOCKER_LABEL) as PrimaryBlocker[];

function parseIntField(raw: string): number | null {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function parseWeight(raw: string): number | null {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Progressive enrichment after onboarding.
 * New users usually only need recovery (sleep/blocker).
 * Legacy users missing body/nutrition still see those fields.
 */
export function CompleteProfileSheet({
  open,
  profile,
  onClose,
  onSave,
}: {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  onSave: (patch: Partial<Profile>) => void;
}) {
  const { acceptLegal } = useStore();
  const priority = enrichmentPriority(profile);
  const needsBody = !isActivationReady(profile);
  const needsNutrition = !isNutritionReady(profile);
  const needsRecovery = !isRecoveryReady(profile);

  const [ageStr, setAgeStr] = useState(profile.age >= 16 ? String(profile.age) : "");
  const [heightStr, setHeightStr] = useState(profile.heightCm >= 130 ? String(profile.heightCm) : "");
  const [weightStr, setWeightStr] = useState(profile.weightKg >= 35 ? String(profile.weightKg) : "");
  const [healthAck, setHealthAck] = useState(false);
  const [typicalSleepHours, setSleep] = useState(profile.typicalSleepHours ?? 7);
  const [primaryBlocker, setBlocker] = useState<PrimaryBlocker>(profile.primaryBlocker ?? "consistencia");
  const [skipBreakfast, setSkipBreakfast] = useState(profile.skipBreakfast === true);
  const [lunchOutOften, setLunchOutOften] = useState(profile.lunchOutOften === true);
  const [foodRestrictions, setFoodRestrictions] = useState<string[]>(
    profile.nutritionProfile?.foodRestrictions ?? [],
  );

  const age = parseIntField(ageStr);
  const heightCm = parseIntField(heightStr);
  const weightKg = parseWeight(weightStr);
  const bodyValid =
    age != null &&
    heightCm != null &&
    weightKg != null &&
    isBodyValidForSave(age, heightCm, weightKg);
  const canSave = needsBody ? bodyValid && healthAck : true;

  const title =
    priority === "body"
      ? "Completar corpo"
      : priority === "nutrition"
        ? "Completar nutrição"
        : "Sono e bloqueio";

  const blurb =
    priority === "body"
      ? "Idade, altura e peso calibram nutrição e água. Sem chute."
      : priority === "nutrition"
        ? "Hábitos alimentares ajustam refeições do plano."
        : "Sono e o que mais te impede — o plano fica mais preciso.";

  return (
    <SoldiersOverlay open={open} onClose={onClose} title={title}>
      <p className="mb-4 text-sm text-muted-foreground">{blurb}</p>
      <div className="space-y-3">
        {needsBody ? (
          <>
            <NumberField
              id="complete-age"
              label="Idade *"
              value={ageStr}
              onChange={setAgeStr}
              placeholder="anos"
              {...(ageStr && (age == null || age < 16 || age > 80) ? { hint: "Entre 16 e 80 anos" } : {})}
            />
            <NumberField
              id="complete-height"
              label="Altura *"
              value={heightStr}
              onChange={setHeightStr}
              placeholder="cm"
              {...(heightStr && (heightCm == null || heightCm < 130 || heightCm > 220)
                ? { hint: "Entre 130 e 220 cm" }
                : {})}
            />
            <NumberField
              id="complete-weight"
              label="Peso *"
              value={weightStr}
              onChange={setWeightStr}
              placeholder="kg"
              {...(weightStr && (weightKg == null || weightKg < 35 || weightKg > 250)
                ? { hint: "Entre 35 e 250 kg" }
                : {})}
            />
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                checked={healthAck}
                onChange={(e) => setHealthAck(e.target.checked)}
              />
              <span className="text-muted-foreground">
                Entendo que peso e medidas servem só para nutrição e água no app. Não saem no social e
                não são dado clínico.
              </span>
            </label>
          </>
        ) : null}

        {needsNutrition ? (
          <>
            <button
              type="button"
              onClick={() => setSkipBreakfast((v) => !v)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                skipBreakfast ? "border-primary bg-primary/10" : "border-white/10"
              }`}
            >
              Pulo o café da manhã
            </button>
            <button
              type="button"
              onClick={() => setLunchOutOften((v) => !v)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                lunchOutOften ? "border-primary bg-primary/10" : "border-white/10"
              }`}
            >
              Almoço fora com frequência
            </button>
            <div className="flex flex-wrap gap-2">
              {FOOD_RESTRICTION_OPTIONS.map((r) => {
                const on = foodRestrictions.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setFoodRestrictions((prev) => (on ? prev.filter((x) => x !== r) : [...prev, r]))
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      on ? "border-primary bg-primary/15 text-primary" : "border-white/10"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {needsRecovery || (!needsBody && !needsNutrition) ? (
          <>
            <NumberRow
              label="Sono típico"
              value={typicalSleepHours}
              onChange={(n) => setSleep(Math.min(12, Math.max(4, n)))}
              unit="h"
            />
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              O que mais te impede?
            </p>
            <div className="flex flex-wrap gap-2">
              {BLOCKERS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBlocker(b)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    primaryBlocker === b ? "border-primary bg-primary/15 text-primary" : "border-white/10"
                  }`}
                >
                  {BLOCKER_LABEL[b]}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <Button
        className="mt-5 h-12 w-full font-bold uppercase tracking-wide"
        disabled={!canSave}
        onClick={() => {
          if (!canSave) return;
          if (needsBody) acceptLegal("health");
          const patch: Partial<Profile> = {};
          if (needsBody && bodyValid) {
            patch.age = age as number;
            patch.heightCm = heightCm as number;
            patch.weightKg = weightKg as number;
          }
          if (needsNutrition) {
            patch.skipBreakfast = skipBreakfast;
            patch.lunchOutOften = lunchOutOften;
            patch.nutritionProfile = buildNutritionProfileFromFlags({
              skipBreakfast,
              lunchOutOften,
              existing: {
                foodPreferences: profile.nutritionProfile?.foodPreferences ?? [],
                foodRestrictions,
                ...(profile.nutritionProfile?.countWheyInMacros ? { countWheyInMacros: true } : {}),
              },
            });
          }
          if (needsRecovery || (!needsBody && !needsNutrition)) {
            patch.typicalSleepHours = typicalSleepHours;
            patch.primaryBlocker = primaryBlocker;
          }
          const merged = { ...profile, ...patch };
          patch.onboardingComplete = isOnboardingFullyComplete(merged);
          onSave(patch);
          onClose();
        }}
      >
        Salvar
      </Button>
    </SoldiersOverlay>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 h-12"
        inputMode="decimal"
      />
      {hint ? <p className="mt-1 text-xs text-destructive">{hint}</p> : null}
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange(value - 1)}>
          −
        </Button>
        <span className="min-w-[3rem] text-center text-sm font-bold">
          {value}
          {unit}
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange(value + 1)}>
          +
        </Button>
      </div>
    </div>
  );
}
