import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAiCoach, type CoachProvider } from "@/lib/coach.functions";
import { COACH_PROMPTS, coachFreeform, coachReply } from "@/lib/engine/coach";
import { coachSystemPrompt } from "@/lib/engine/coach-context";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "Coach — Soldiers Performance OS" },
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

type Engine = "regras" | CoachProvider;

const ENGINES: Array<{ id: Engine; label: string }> = [
  { id: "regras", label: "Coach padrão" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
];

const ENGINE_KEY = "soldiers-coach-engine";

function CoachPage() {
  const { state, hydrated, pushChat } = useStore();
  const ask = useServerFn(askAiCoach);
  const [engine, setEngine] = useState<Engine>("regras");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(ENGINE_KEY) as Engine | null;
    if (saved === "chatgpt" || saved === "claude" || saved === "regras") setEngine(saved);
  }, []);

  const chooseEngine = (next: Engine) => {
    setEngine(next);
    window.localStorage.setItem(ENGINE_KEY, next);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.chat.length, loading]);

  useEffect(() => {
    if (hydrated && state.chat.length === 0 && state.profile) {
      pushChat(
        "coach",
        `Fala, ${state.profile.name.split(" ")[0]}. Sou seu coach de performance. Posso montar o próximo passo, ajustar volume e organizar sua suplementação. O que você quer resolver agora?`,
      );
    }
  }, [hydrated, state.chat.length, state.profile, pushChat]);

  const answer = async (question: string, fallback: string) => {
    if (engine === "regras") {
      pushChat("coach", fallback);
      return;
    }
    setLoading(true);
    try {
      const history = state.chat.slice(-8).map((m) => ({
        role: m.role === "coach" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }));
      const res = await ask({
        data: {
          provider: engine,
          system: coachSystemPrompt(state),
          messages: [...history, { role: "user" as const, content: question }],
        },
      });
      pushChat("coach", res.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível falar com a IA agora.");
      pushChat("coach", fallback);
    } finally {
      setLoading(false);
    }
  };

  const askPrompt = (promptId: string, label: string) => {
    pushChat("user", label);
    void answer(label, coachReply(promptId, state));
  };

  const send = () => {
    const value = text.trim();
    if (!value || loading) return;
    pushChat("user", value);
    setText("");
    void answer(value, coachFreeform(value, state));
  };

  return (
    <AppShell title="Coach" subtitle="Respostas baseadas nos seus dados de treino">
      <div className="mb-4 flex gap-2">
        {ENGINES.map((e) => (
          <button
            key={e.id}
            onClick={() => chooseEngine(e.id)}
            className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
              engine === e.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {state.chat.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              m.role === "coach" ? "bg-card text-foreground" : "ml-auto bg-primary text-primary-foreground"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading ? (
          <div className="flex max-w-[85%] items-center gap-2 rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Pensando...
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {COACH_PROMPTS.map((p) => (
          <button
            key={p.id}
            disabled={loading}
            onClick={() => askPrompt(p.id, p.label)}
            className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
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
          className="h-12"
        />
        <Button size="icon" className="size-12" onClick={send} disabled={loading} aria-label="Enviar">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </AppShell>
  );
}
