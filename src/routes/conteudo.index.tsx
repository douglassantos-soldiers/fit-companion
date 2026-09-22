import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listPublishedContent } from "@/lib/content-match";
import { listContentOsPrograms } from "@/lib/content/catalog";
import { useStore } from "@/lib/store";
import { blockDisplayWeek } from "@/lib/training/training-block";

export const Route = createFileRoute("/conteudo/")({
  head: () => ({
    meta: [
      { title: "Conteúdo — Soldiers Training" },
      { name: "description", content: "Artigos, dicas e trilhas de treino por objetivo e nível." },
    ],
  }),
  component: ConteudoIndex,
});

function ConteudoIndex() {
  const navigate = useNavigate();
  const { state, enrollInProgram, leaveTrainingBlock } = useStore();
  const items = listPublishedContent();
  const programs = listContentOsPrograms();
  const active = state.activeTrainingBlock;

  return (
    <AppShell title="Conteúdo">
      <Tabs defaultValue="trilhas">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trilhas">Trilhas</TabsTrigger>
          <TabsTrigger value="editorial">Editorial</TabsTrigger>
        </TabsList>

        <TabsContent value="trilhas" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Programas prescritos de 4–8 semanas. O Living Plan continua ajustando express, deload e
            rest.
          </p>
          {active ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-primary">
                  Em andamento
                </p>
                <p className="truncate text-sm font-semibold">
                  {active.name} · Semana {blockDisplayWeek(active)}/{active.durationWeeks}
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => leaveTrainingBlock()}>
                Sair
              </Button>
            </div>
          ) : null}
          {!programs.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma trilha publicada ainda.</p>
          ) : (
            programs.map((program) => {
              const isActive = active?.programId === program.id;
              return (
                <article key={program.id} className="surface-card space-y-3 p-4">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wide text-primary">
                      {program.durationWeeks} semanas · {program.sessionsPerWeek}x/semana
                      {program.level ? ` · ${program.level}` : ""}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{program.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{program.description}</p>
                  </div>
                  {isActive ? (
                    <Link to="/treino">
                      <Button className="h-11 w-full font-bold uppercase tracking-wide">
                        Ir para o treino
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className="h-11 w-full font-bold uppercase tracking-wide"
                      onClick={() => {
                        if (active && active.programId !== program.id) {
                          toast.message(`Trocando de "${active.name}" para "${program.title}"`);
                        }
                        const ok = enrollInProgram(program.id);
                        if (ok) {
                          toast.success(`Trilha iniciada: ${program.title}`);
                          void navigate({ to: "/treino" });
                        } else {
                          toast.error(
                            "Esta trilha não tem treinos prescritos ainda — use outra ou fale com o coach.",
                          );
                        }
                      }}
                    >
                      {active && active.programId !== program.id ? "Trocar trilha" : "Começar trilha"}
                    </Button>
                  )}
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="editorial" className="mt-4">
          <p className="text-sm text-muted-foreground">
            Material editorial filtrado no app pelo seu perfil.
          </p>
          {!items.length ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum artigo publicado ainda.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    to="/conteudo/$id"
                    params={{ id: item.id }}
                    className="surface-card block p-4"
                  >
                    <p className="text-[0.65rem] uppercase tracking-wide text-primary">{item.kind}</p>
                    <p className="mt-1 text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
