import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { getPublishedContentById } from "@/lib/content-match";

export const Route = createFileRoute("/conteudo/$id")({
  head: ({ params }) => {
    const item = getPublishedContentById(params.id);
    return {
      meta: [
        { title: `${item?.title ?? "Conteúdo"} — Soldiers Training` },
        { name: "description", content: item?.body.slice(0, 140) ?? "Conteúdo Soldiers." },
      ],
    };
  },
  component: ConteudoItem,
});

function ConteudoItem() {
  const { id } = Route.useParams();
  const item = getPublishedContentById(id);
  return (
    <AppShell title={item?.title ?? "Conteúdo"}>
      <Link to="/conteudo" className="text-xs text-primary">
        ← Todos
      </Link>
      {!item ? (
        <p className="mt-4 text-sm text-muted-foreground">Conteúdo indisponível ou ainda não publicado.</p>
      ) : (
        <article className="mt-4 space-y-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-primary">{item.kind}</p>
          <h1 className="text-display text-2xl">{item.title}</h1>
          {item.mediaUrl ? (
            <img src={item.mediaUrl} alt="" className="max-h-64 w-full rounded-xl object-cover" />
          ) : null}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.body}</div>
        </article>
      )}
    </AppShell>
  );
}
