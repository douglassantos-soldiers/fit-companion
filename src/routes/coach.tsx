import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAiCoach, type CoachStructuredReply } from "@/lib/coach.functions";
import { acceptCoachProposal, proposalAcceptLabel } from "@/lib/coach/apply-proposal";
import { makeProposal } from "@/lib/coach/proposals";
import type { CoachProposal } from "@/lib/coach/types";
import { coachNudgeFromState } from "@/lib/engine/coach-nudge";
import { COACH_PROMPTS, coachFreeform, coachReply } from "@/lib/engine/coach";
import { buildDailyMealPlan } from "@/lib/engine/nutrition";
import { useStore } from "@/lib/store";
import { getDeviceId } from "@/lib/sync";
import type { AppState, ChatMessage } from "@/lib/types";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "Coach — Soldiers Training" },
      {
        name: "description",
        content: "Seu coach de performance responde com base nos seus treinos, peso e aderência.",
      },
      { property: "og:title", content: "Performance Coach" },
      { property: "og:description", content: "Ajustes de treino, volume e suplementação em conversa." },
    ],
  }),
  component: CoachPage,
});

const ENGINE_KEY = "soldiers-coach-engine";

function mapChat(messages: ChatMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role === "coach" ? ("assistant" as const) : ("user" as const),
      content: m.text,
    }));
}

function localProposalForPrompt(promptId: string): CoachProposal | null {
  switch (promptId) {
    case "sem-tempo":
      return makeProposal("EXPRESS_WORKOUT", true, ["limited_time"], {}, 0.8);
    case "dor":
      return makeProposal("DELOAD", true, ["soreness"], {}, 0.75);
    case "por-que-descanso":
      return makeProposal("REST", true, ["recovery"], {}, 0.75);
    case "hoje":
      return makeProposal("FULL_WORKOUT", true, ["today_plan"], {}, 0.65);
    case "nutricao":
    case "por-que-proteina":
      return makeProposal("NUTRITION_FOCUS", true, ["protein_low"], {}, 0.7);
    default:
      return null;
  }
}

function localProposalForFreeform(value: string): CoachProposal | null {
  const t = value.toLowerCase();
  if (t.includes("minuto") || t.includes("tempo") || t.includes("express")) {
    return makeProposal("EXPRESS_WORKOUT", true, ["limited_time"], {}, 0.75);
  }
  if (t.includes("dolor") || t.includes("deload")) {
    return makeProposal("DELOAD", true, ["soreness"], {}, 0.7);
  }
  if (t.includes("descans") || t.includes("sono")) {
    return makeProposal("REST", true, ["recovery"], {}, 0.7);
  }
  if (t.includes("água") || t.includes("agua") || t.includes("hidrata")) {
    return makeProposal("HYDRATION_FOCUS", true, ["hydration"], {}, 0.7);
  }
  if (t.includes("prote") || t.includes("refei") || t.includes("nutri") || t.includes("comida")) {
    return makeProposal("NUTRITION_FOCUS", true, ["protein_low"], {}, 0.7);
  }
  return null;
}

function formatCoachReply(text: string, structured?: CoachStructuredReply | null): string {
  if (!structured) return text;
  const parts = [text];
  if (structured.safetyNotice) {
    parts.push(`\n\nAtenção: ${structured.safetyNotice}`);
  }
  if (structured.kind === "why" && structured.why.length) {
    parts.push(`\n\nPor quê:\n${structured.why.slice(0, 4).map((w) => `• ${w}`).join("\n")}`);
  }
  if (structured.evidence) {
    const e = structured.evidence;
    const bits: string[] = [];
    if (e.sleepHours != null) bits.push(`sono ${e.sleepHours}h`);
    if (e.hardRpeStreak != null && e.hardRpeStreak > 0) bits.push(`RPE difícil ×${e.hardRpeStreak}`);
    if (e.decisionSummary) bits.push(e.decisionSummary);
    if (e.trainingMode) bits.push(`modo ${e.trainingMode}`);
    if (bits.length) parts.push(`\n\nEvidências: ${bits.join(" · ")}`);
  }
  return parts.join("");
}

function CoachPage() {
  const navigate = useNavigate();
  const { state, hydrated, pushChat, markQuestCoachOpened, saveDayCheckIn, refreshLivingPlan, addWater, addMealEntry } =
    useStore();
  const askAi = useServerFn(askAiCoach);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastActions, setLastActions] = useState<NonNullable<CoachStructuredReply["actions"]>>([]);
  const [lastProposals, setLastProposals] = useState<NonNullable<CoachStructuredReply["proposals"]>>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const offlineToastShown = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    window.localStorage.removeItem(ENGINE_KEY);
  }, []);

  useEffect(() => {
    markQuestCoachOpened();
  }, [markQuestCoachOpened]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.chat.length]);

  useEffect(() => {
    if (hydrated && state.chat.length === 0 && state.profile) {
      pushChat(
        "coach",
        `Fala, ${state.profile.name.split(" ")[0]}. Sou seu coach de performance. Posso montar o próximo passo, ajustar volume e organizar sua suplementação. O que você quer resolver agora?`,
      );
    }
  }, [hydrated, state.chat.length, state.profile, pushChat]);

  const notifyOfflineOnce = (reason?: string) => {
    if (offlineToastShown.current) return;
    offlineToastShown.current = true;
    const msg =
      reason === "unauthorized"
        ? "Sessão expirada — libere o acesso de novo"
        : reason === "rate_limited"
          ? "Limite do coach atingido — tente mais tarde"
          : reason === "not_configured"
            ? "Coach em modo offline — configure OPENAI_API_KEY no servidor"
            : reason === "upstream"
              ? "Coach indisponível agora — usando respostas locais"
              : "Coach em modo offline — respostas locais";
    toast.message(msg);
  };

  const runAi = async (snapshot: AppState, userText: string, offlineReply: string) => {
    try {
      const history = mapChat(snapshot.chat);
      const messages = [...history, { role: "user" as const, content: userText }];
      const deviceId = getDeviceId();
      const result = await askAi({
        data: {
          provider: "chatgpt",
          ...(deviceId ? { deviceId } : {}),
          messages,
        },
      });
      if (result?.structured?.actions?.length) {
        setLastActions(result.structured.actions);
      }
      if (result?.structured?.proposals?.length) {
        setLastProposals(result.structured.proposals);
      }
      if (result?.error) {
        return {
          text: formatCoachReply(offlineReply, result.structured),
          offline: true,
          reason: result.error,
        };
      }
      if (result?.text?.trim()) {
        return {
          text: formatCoachReply(result.text.trim(), result.structured),
          offline: false as const,
        };
      }
      return { text: offlineReply, offline: true as const };
    } catch (e) {
      console.warn("askAiCoach failed", e);
      return { text: offlineReply, offline: true as const, reason: "upstream" };
    } finally {
      void import("@/lib/outcome").then(({ trackOutcome }) =>
        trackOutcome(getDeviceId(), "coach_interaction", {
          offline: false,
          entityType: "coach",
          entityId: "chat",
        }),
      );
    }
  };

  const askPrompt = (promptId: string, label: string) => {
    if (busy) return;
    const snapshot = stateRef.current;
    pushChat("user", label);
    setBusy(true);
    setLastProposals([]);
    void runAi(snapshot, label, coachReply(promptId, snapshot)).then(({ text: reply, offline, reason }) => {
      pushChat("coach", reply);
      if (offline) notifyOfflineOnce(reason);
      setLastProposals((prev) => {
        if (prev.length) return prev;
        const local = localProposalForPrompt(promptId);
        return local ? [local] : [];
      });
      setBusy(false);
    });
  };

  const send = () => {
    const value = text.trim();
    if (!value || busy) return;
    const snapshot = stateRef.current;
    pushChat("user", value);
    setText("");
    setBusy(true);
    setLastProposals([]);
    void runAi(snapshot, value, coachFreeform(value, snapshot)).then(({ text: reply, offline, reason }) => {
      pushChat("coach", reply);
      if (offline) notifyOfflineOnce(reason);
      setLastProposals((prev) => {
        if (prev.length) return prev;
        const local = localProposalForFreeform(value);
        return local ? [local] : [];
      });
      setBusy(false);
    });
  };

  return (
    <AppShell title="Coach" subtitle={busy ? "Pensando…" : "Treino, comida e suplementos com base nos seus dados"}>
      {coachNudgeFromState({
        ...state,
        coachNudgeDismissedAt: null,
        coachNudgeShownAt: null,
      }).show ? (
        <Link
          to="/progresso/resumo"
          className="mb-3 inline-flex rounded-full border border-primary/40 bg-card/40 px-3 py-1.5 text-xs font-semibold text-primary"
        >
          Volume subiu — ver análise
        </Link>
      ) : null}
      <div className="space-y-3">
        {state.chat.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
              m.role === "coach"
                ? "surface-glass text-foreground"
                : "ml-auto bg-primary text-primary-foreground glow-primary"
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy ? (
          <div className="surface-glass max-w-[85%] animate-pulse px-4 py-3 text-sm text-muted-foreground">…</div>
        ) : null}
        <div ref={endRef} />
      </div>

      {lastProposals.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {lastProposals.map((p, i) => (
            <button
              key={`${p.type}-${i}`}
              type="button"
              className="rounded-full border border-primary bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary"
              onClick={() => {
                const todayCheck = state.dayCheckIns?.[todayKey()];
                const mealPlan = state.profile ? buildDailyMealPlan(state.profile, state, todayKey()) : null;
                const result = acceptCoachProposal(p, {
                  ...(todayCheck ? { checkIn: todayCheck } : {}),
                  mealPlan,
                });
                if (result.kind === "water") {
                  addWater(result.ml);
                  toast.success(`${result.ml} ml de água registrados`);
                  setLastProposals([]);
                  return;
                }
                if (result.kind === "meal") {
                  addMealEntry(result.entry);
                  toast.success(`${result.label} registrado`);
                  setLastProposals([]);
                  return;
                }
                if (result.kind === "navigate") {
                  void navigate({ to: "/nutricao" });
                  return;
                }
                if (result.kind === "checkin") {
                  saveDayCheckIn(result.patch);
                  refreshLivingPlan();
                  toast.success("Proposta aceita — plano de hoje atualizado");
                  setLastProposals([]);
                  return;
                }
                toast.message("Essa proposta abre o treino de hoje.");
                void navigate({ to: "/" });
              }}
            >
              {proposalAcceptLabel(p)}
            </button>
          ))}
        </div>
      ) : null}

      {lastActions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {lastActions.map((a) => (
            <Link
              key={a.id}
              to={a.href}
              className="rounded-full border border-primary/40 bg-card/40 px-3 py-1.5 text-xs font-semibold text-primary"
            >
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {COACH_PROMPTS.map((p) => (
          <button
            key={p.id}
            disabled={busy}
            onClick={() => askPrompt(p.id, p.label)}
            className="whitespace-nowrap rounded-full border border-primary/40 bg-card/40 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Pergunte algo ao coach"
          className="h-12 rounded-full border-white/10 bg-card/40 backdrop-blur"
          disabled={busy}
        />
        <Button size="icon" className="size-12 glow-primary" onClick={send} aria-label="Enviar" disabled={busy}>
          <Send className="size-4" />
        </Button>
      </div>
    </AppShell>
  );
}
