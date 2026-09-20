import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Dumbbell, MessageSquare, Trophy } from "lucide-react";
import { SoldiersLogo } from "@/components/soldiers-logo";
import { SoldiersMediaFrame } from "@/components/soldiers-media-frame";
import { Button } from "@/components/ui/button";
import { getStorefrontBaseUrl, performanceUpgradeUrl } from "@/data/shopify-product-map";
import { resolveBrandMedia, resolveHowtoMedia } from "@/lib/soldiers-media";

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
  const hero = resolveBrandMedia("welcome-hero");
  const howto = resolveHowtoMedia("complete-set");
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
      <div className="pointer-events-none absolute -left-20 top-24 size-72 rounded-full bg-primary/25 blur-3xl" />
      {hero.posterUrl || hero.webmUrl || hero.mp4Url ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] opacity-40">
          <SoldiersMediaFrame media={hero} alt="" className="h-full w-full" imgClassName="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        </div>
      ) : null}
      <div className="relative mx-auto flex w-full max-w-md flex-col px-5 pb-[11rem] pt-8">
        <SoldiersLogo />

        <section className="mt-10">
          <p className="eyebrow">Soldiers Training</p>
          <h1 className="mt-3 text-display text-4xl leading-none">
            Treino do dia
            <span className="mt-1 block text-primary text-glow">incluso na compra</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Plano, proteína, coach e ranking — sem mensalidade extra. O acesso vale 40 dias a partir da
            última compra Soldiers.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <Benefit icon={Dumbbell} title="Treino personalizado" body="Carga, séries e deload com base no seu RPE." />
          <Benefit icon={MessageSquare} title="Coach" body="Próximo passo em conversa, com seus dados." />
          <Benefit icon={Trophy} title="Social" body="Desafios, clubes e feed com ranking real." />
        </section>

        {howto.posterUrl || howto.webmUrl || howto.mp4Url ? (
          <section className="surface-glass mt-10 overflow-hidden p-0">
            <div className="flex items-stretch gap-3">
              <SoldiersMediaFrame
                media={howto}
                alt="Como completar uma série"
                className="h-24 w-24 shrink-0"
                imgClassName="object-cover"
              />
              <div className="py-3 pr-4">
                <p className="eyebrow">Como fazer</p>
                <p className="mt-1 text-sm font-bold">Termine a série</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Trave a barra, registre o set — o app guarda carga e RPE.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="surface-glass mt-10 p-5">
          <p className="eyebrow">O que está incluso</p>
          <h2 className="mt-1 text-display text-2xl">Base e Performance</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong className="text-foreground">Base</strong> — qualquer pedido pago nos últimos 40 dias
            libera o app. <strong className="text-foreground">Performance</strong> — whey + creatina, Striker
            ou tag VIP destrava liga e desafios.
          </p>
          <a href={PERFORMANCE_URL} target="_blank" rel="noreferrer" className="mt-5 block">
            <Button variant="secondary" className="h-11 w-full font-bold uppercase tracking-wide">
              Escolher kit Performance
            </Button>
          </a>
        </section>

        <p className="mt-8 pb-4 text-center text-[0.7rem] text-muted-foreground">
          Sem mensalidade extra: o acesso vale 40 dias a partir da última compra paga.
        </p>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/90 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <Link to="/cadastro" className="block">
            <Button size="lg" className="h-14 w-full glow-primary font-bold uppercase tracking-wide">
              Começar com minha compra <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link to="/entrar" className="mt-2 block">
            <Button size="lg" variant="secondary" className="h-12 w-full font-bold uppercase tracking-wide">
              Já tenho conta — entrar
            </Button>
          </Link>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Ainda não comprou?{" "}
            <a href={STORE_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary">
              Ver kits na loja
            </a>
          </p>
        </div>
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
