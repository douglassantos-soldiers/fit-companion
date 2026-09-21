import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GoalScheme, SplitDay, TrainingRules } from "@/lib/training/training-rules";
import type { Goal, Level } from "@/lib/types";

const GOALS: Goal[] = ["massa", "gordura", "performance", "saude"];
const LEVELS: Level[] = ["iniciante", "intermediario", "avancado"];

export function ProgramsTab({
  rules,
  setRules,
  busy,
  onSave,
}: {
  rules: TrainingRules | null;
  setRules: (r: TrainingRules) => void;
  busy: boolean;
  onSave: () => void;
}) {
  if (!rules) {
    return <p className="text-sm text-muted-foreground">Carregue as regras de treino.</p>;
  }

  const patchScheme = (goal: Goal, patch: Partial<GoalScheme>) => {
    setRules({
      ...rules,
      goalScheme: { ...rules.goalScheme, [goal]: { ...rules.goalScheme[goal], ...patch } },
    });
  };

  const patchSplitDay = (days: number, idx: number, patch: Partial<SplitDay>) => {
    const list = [...(rules.splits[days] ?? [])];
    const cur = list[idx];
    if (!cur) return;
    list[idx] = { ...cur, ...patch };
    setRules({ ...rules, splits: { ...rules.splits, [days]: list } });
  };

  return (
    <div className="space-y-4">
      <Button onClick={onSave} disabled={busy}>
        {busy ? "Salvando…" : "Salvar regras"}
      </Button>
      <div className="surface-glass space-y-2 p-4">
        <p className="text-sm font-semibold">Fator por nível</p>
        {LEVELS.map((lv) => (
          <div key={lv} className="flex items-center gap-2">
            <Label className="w-32 text-xs">{lv}</Label>
            <Input
              type="number"
              step="0.05"
              value={rules.levelFactor[lv]}
              onChange={(e) =>
                setRules({
                  ...rules,
                  levelFactor: { ...rules.levelFactor, [lv]: Number(e.target.value) },
                })
              }
            />
          </div>
        ))}
      </div>
      <div className="surface-glass space-y-3 p-4">
        <p className="text-sm font-semibold">Scheme por objetivo</p>
        {GOALS.map((g) => {
          const s = rules.goalScheme[g];
          return (
            <div key={g} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <p className="col-span-2 text-xs font-semibold sm:col-span-4">{g}</p>
              <Input
                type="number"
                value={s.sets}
                onChange={(e) => patchScheme(g, { sets: Number(e.target.value) })}
              />
              <Input value={s.reps} onChange={(e) => patchScheme(g, { reps: e.target.value })} />
              <Input
                type="number"
                value={s.restSec}
                onChange={(e) => patchScheme(g, { restSec: Number(e.target.value) })}
              />
              <Input
                type="number"
                step="0.05"
                value={s.loadFactor}
                onChange={(e) => patchScheme(g, { loadFactor: Number(e.target.value) })}
              />
            </div>
          );
        })}
      </div>
      {Object.keys(rules.splits)
        .map(Number)
        .sort((a, b) => a - b)
        .map((days) => (
          <div key={days} className="surface-glass space-y-2 p-4">
            <p className="text-sm font-semibold">{days} dias / semana</p>
            {(rules.splits[days] ?? []).map((d, i) => (
              <div key={`${days}-${i}`} className="space-y-1 rounded-lg border border-white/10 p-2">
                <Input
                  value={d.title}
                  onChange={(e) => patchSplitDay(days, i, { title: e.target.value })}
                />
                <Input
                  value={d.focus}
                  onChange={(e) => patchSplitDay(days, i, { focus: e.target.value })}
                />
                <Input
                  value={d.groups.join(",")}
                  onChange={(e) =>
                    patchSplitDay(days, i, {
                      groups: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean) as SplitDay["groups"],
                    })
                  }
                />
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
