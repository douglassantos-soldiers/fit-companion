import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Dumbbell, MessageSquare, Trophy } from "lucide-react";
import { SoldiersLogo } from "@/components/soldiers-logo";
import { Button } from "@/components/ui/button";
import { getStorefrontBaseUrl, performanceUpgradeUrl } from "@/data/shopify-product-map";

const STORE_URL = getStorefrontBaseUrl();
const PERFORMANCE_URL = performanceUpgradeUrl();

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Soldiers Training" },
      {
        name: "description",
        content: "Treino, nutrição, coach e desafios — liberado com sua compra Soldiers.",
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
      <div className="pointer-events-none absolute -left-20 top-24 size-72 rounded-full bg-primary/25 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-md flex-col px-5 py-8">
        <SoldiersLogo />

        <section className="mt-10">
          <p className="eyebrow">Soldiers Training</p>
          <h1 className="mt-3 text-display text-4xl leading-none">
            Soldiers Training
            <span className="mt-1 block text-primary text-glow">no seu bolso</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Plano de treino do dia, proteína, coach e ranking — incluso na sua compra na loja Soldiers.
          </p>
          <Link to="/acesso" search={{ token: undefined }} className="mt-8 block">
            <Button size="lg" className="h-14 w-full glow-primary font-bold uppercase tracking-wide">
              Já comprei — liberar acesso <ArrowRight className="size-4" />
            </Button>
          </Link>
          <a href={STORE_URL} target="_blank" rel="noreferrer" className="mt-3 block">
            <Button size="lg" variant="secondary" className="h-12 w-full font-bold uppercase tracking-wide">
              Ver kits na loja
            </Button>
          </a>
        </section>

        <section className="mt-10 space-y-3">
          <Benefit icon={Dumbbell} title="Treino personalizado" body="Carga, séries e deload com base no seu RPE." />
          <Benefit icon={MessageSquare} title="Coach" body="Próximo passo em conversa, com seus dados." />
          <Benefit icon={Trophy} title="Social" body="Desafios, clubes e feed com ranking real." />
        </section>

        <section className="surface-glass mt-10 p-5">
          <p className="eyebrow">Planos</p>
          <h2 className="mt-1 text-display text-2xl">Base e Performance</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong>Base</strong> — qualquer pedido pago libera o app (treino, nutrição, coach, desafios).
              </span>
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong>Performance</strong> — kit whey + creatina, Striker ou tag VIP desbloqueia desafios exclusivos.
              </span>
            </li>
          </ul>
          <a href={PERFORMANCE_URL} target="_blank" rel="noreferrer" className="mt-5 block">
            <Button className="h-11 w-full font-bold uppercase tracking-wide">Escolher kit Performance</Button>
          </a>
        </section>

        <p className="mt-8 text-center text-[0.7rem] text-muted-foreground">
          Sem mensalidade extra: o acesso é permanente após a compra verificada.
        </p>
      </div>
    </div>
  );
}

function Benefit({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Dumbbell;
  title: string;
  body: string;
}) {
  return (
    <div className="surface-glass flex items-start gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
