import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COACH_PROMPTS, coachFreeform, coachReply } from "@/lib/engine/coach";
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

function CoachPage() {
  const { state, hydrated, pushChat } = useStore();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

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

  const ask = (promptId: string, label: string) => {
    pushChat("user", label);
    pushChat("coach", coachReply(promptId, state));
  };

  const send = () => {
    const value = text.trim();
    if (!value) return;
    pushChat("user", value);
    pushChat("coach", coachFreeform(value, state));
    setText("");
  };

  return (
    <AppShell title="Coach" subtitle="Respostas baseadas nos seus dados de treino">
      <div className="space-y-3">
        {state.chat.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              m.role === "coach"
                ? "bg-card text-foreground"
                : "ml-auto bg-primary text-primary-foreground"
            }`}
          >
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {COACH_PROMPTS.map((p) => (
          <button
            key={p.id}
            onClick={() => ask(p.id, p.label)}
            className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
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
        <Button size="icon" className="size-12" onClick={send} aria-label="Enviar">
          <Send className="size-4" />
        </Button>
      </div>
    </AppShell>
  );
}
