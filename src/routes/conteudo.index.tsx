import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { listPublishedContent } from "@/lib/content-match";

export const Route = createFileRoute("/conteudo/")({
  head: () => ({
    meta: [
      { title: "Conteúdo — Soldiers Training" },
      { name: "description", content: "Artigos, dicas e técnica por objetivo e nível." },
    ],
  }),
  component: ConteudoIndex,
});

function ConteudoIndex() {
  const items = listPublishedContent();
  return (
    <AppShell title="Conteúdo">
      <p className="text-sm text-muted-foreground">Material editorial filtrado no app pelo seu perfil.</p>
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
    </AppShell>
  );
}
