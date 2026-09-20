import { Button } from "@/components/ui/button";
import { SoldiersOverlay } from "@/components/soldiers-overlay";
import { MEAL_PRESETS } from "@/data/meal-presets";
import { ALL_MEAL_SLOTS, FOOD_RESTRICTION_OPTIONS } from "@/lib/engine/nutrition-profile";
import { MEAL_SLOT_LABEL, type BudgetLevel, type EatingDifficulty, type MealSlot, type NutritionProfile, type Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NutritionAjustesSheet({
  open,
  profile,
  favoriteIds = [],
  onToggleFavorite,
  onClose,
  onSave,
}: {
  open: boolean;
  profile: Profile;
  favoriteIds?: string[];
  onToggleFavorite?: (id: string) => void;
  onClose: () => void;
  onSave: (patch: Partial<Profile>) => void;
}) {
  const np = profile.nutritionProfile;
  const active = new Set(np?.activeSlots?.length ? np.activeSlots : ALL_MEAL_SLOTS.filter((s) => !(profile.skipBreakfast && s === "cafe")));
  const restrictions = new Set(np?.foodRestrictions ?? []);

  const toggleSlot = (slot: MealSlot) => {
    const next = ALL_MEAL_SLOTS.filter((s) => (s === slot ? !active.has(s) : active.has(s)));
    if (next.length < 1) return;
    persist({
      skipBreakfast: !next.includes("cafe"),
      nutritionProfile: mergeNp(profile, {
        activeSlots: next,
        mealWindows: {
          ...(np?.mealWindows ?? {}),
          [slot]: { enabled: next.includes(slot) },
        },
      }),
    });
  };

  const persist = (patch: Partial<Profile>) => onSave(patch);

  const mergeNp = (p: Profile, over: Partial<NutritionProfile>): NutritionProfile => ({
    foodPreferences: p.nutritionProfile?.foodPreferences ?? [],
    foodRestrictions: p.nutritionProfile?.foodRestrictions ?? [],
    ...(p.nutritionProfile?.mealWindows ? { mealWindows: p.nutritionProfile.mealWindows } : {}),
    ...(p.nutritionProfile?.eatingDifficulty ? { eatingDifficulty: p.nutritionProfile.eatingDifficulty } : {}),
    ...(p.nutritionProfile?.budgetLevel ? { budgetLevel: p.nutritionProfile.budgetLevel } : {}),
    ...(p.nutritionProfile?.eatsOutFrequency ? { eatsOutFrequency: p.nutritionProfile.eatsOutFrequency } : {}),
    ...(p.nutritionProfile?.activeSlots ? { activeSlots: p.nutritionProfile.activeSlots } : {}),
    ...(p.nutritionProfile?.countWheyInMacros ? { countWheyInMacros: true } : {}),
    ...over,
  });

  return (
    <SoldiersOverlay open={open} onClose={onClose} title="Ajustes de nutrição">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Refeições do dia</p>
        <div className="flex flex-wrap gap-2">
          {ALL_MEAL_SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                active.has(s) ? "border-primary bg-primary/15 text-primary" : "border-white/10",
              )}
              onClick={() => toggleSlot(s)}
            >
              {MEAL_SLOT_LABEL[s]}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rotina</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              profile.skipBreakfast ? "border-primary bg-primary/15 text-primary" : "border-white/10",
            )}
            onClick={() =>
              persist({
                skipBreakfast: !profile.skipBreakfast,
                nutritionProfile: mergeNp(profile, {
                  activeSlots: ALL_MEAL_SLOTS.filter((s) => (s === "cafe" ? profile.skipBreakfast : active.has(s))),
                }),
              })
            }
          >
            Pulo o café
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              profile.lunchOutOften ? "border-primary bg-primary/15 text-primary" : "border-white/10",
            )}
            onClick={() =>
              persist({
                lunchOutOften: !profile.lunchOutOften,
                nutritionProfile: mergeNp(profile, {
                  eatsOutFrequency: profile.lunchOutOften ? "raro" : "frequente",
                }),
              })
            }
          >
            Almoço fora
          </button>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Restrições</p>
        <div className="flex flex-wrap gap-2">
          {FOOD_RESTRICTION_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                restrictions.has(r) ? "border-primary bg-primary/15 text-primary" : "border-white/10",
              )}
              onClick={() => {
                const next = restrictions.has(r)
                  ? (np?.foodRestrictions ?? []).filter((x) => x !== r)
                  : [...(np?.foodRestrictions ?? []), r];
                persist({ nutritionProfile: mergeNp(profile, { foodRestrictions: next }) });
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meu cardápio</p>
        <p className="text-[0.65rem] text-muted-foreground">O plano puxa desses presets primeiro.</p>
        <div className="flex flex-wrap gap-2">
          {MEAL_PRESETS.slice(0, 8).map((p) => {
            const on = favoriteIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  on ? "border-primary bg-primary/15 text-primary" : "border-white/10",
                )}
                onClick={() => onToggleFavorite?.(p.id)}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estilo</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["baixo", "Barato"],
              ["medio", "Médio"],
              ["alto", "Livre"],
            ] as Array<[BudgetLevel, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                np?.budgetLevel === id ? "border-primary bg-primary/15 text-primary" : "border-white/10",
              )}
              onClick={() => persist({ nutritionProfile: mergeNp(profile, { budgetLevel: id }) })}
            >
              {label}
            </button>
          ))}
          {(
            [
              ["baixa", "Simples"],
              ["alta", "Prático"],
            ] as Array<[EatingDifficulty, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                np?.eatingDifficulty === id ? "border-primary bg-primary/15 text-primary" : "border-white/10",
              )}
              onClick={() => persist({ nutritionProfile: mergeNp(profile, { eatingDifficulty: id }) })}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={cn(
            "w-full rounded-xl border px-3 py-2 text-left text-sm",
            np?.countWheyInMacros ? "border-primary bg-primary/10" : "border-white/10",
          )}
          onClick={() =>
            persist({
              nutritionProfile: mergeNp(profile, { countWheyInMacros: !np?.countWheyInMacros }),
            })
          }
        >
          Somar whey/beef na proteína do dia
        </button>

        <Button className="h-11 w-full font-bold uppercase tracking-wide" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </SoldiersOverlay>
  );
}
