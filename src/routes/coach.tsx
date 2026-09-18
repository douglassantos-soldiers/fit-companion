import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAiCoach } from "@/lib/coach.functions";
import { COACH_PROMPTS, coachFreeform, coachReply } from "@/lib/engine/coach";
import { coachSystemPrompt } from "@/lib/engine/coach-context";
import { useStore } from "@/lib/store";
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

function CoachPage() {
  const { state, hydrated, pushChat, markQuestCoachOpened } = useStore();
  const askAi = useServerFn(askAiCoach);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
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
      const result = await askAi({
        data: {
          provider: "chatgpt",
          context: coachSystemPrompt(snapshot),
          messages,
        },
      });
      if (result?.error) {
        return { text: offlineReply, offline: true, reason: result.error };
      }
      if (result?.text?.trim()) return { text: result.text.trim(), offline: false as const };
      return { text: offlineReply, offline: true as const };
    } catch (e) {
      console.warn("askAiCoach failed", e);
      return { text: offlineReply, offline: true as const, reason: "upstream" };
    }
  };

  const askPrompt = (promptId: string, label: string) => {
    if (busy) return;
    const snapshot = stateRef.current;
    pushChat("user", label);
    setBusy(true);
    void runAi(snapshot, label, coachReply(promptId, snapshot)).then(({ text: reply, offline, reason }) => {
      pushChat("coach", reply);
      if (offline) notifyOfflineOnce(reason);
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
    void runAi(snapshot, value, coachFreeform(value, snapshot)).then(({ text: reply, offline, reason }) => {
      pushChat("coach", reply);
      if (offline) notifyOfflineOnce(reason);
      setBusy(false);
    });
  };

  return (
    <AppShell title="Coach" subtitle={busy ? "Pensando…" : "Treino, comida e suplementos com base nos seus dados"}>
      <div className="space-y-3">
        {state.chat.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
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
