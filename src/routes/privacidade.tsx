import { createFileRoute, Link } from "@tanstack/react-router";
import { SoldiersLogo } from "@/components/soldiers-logo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade — Soldiers Training" },
      {
        name: "description",
        content: "O que o Soldiers Training coleta, para quê, e como exportar ou apagar seus dados.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-5 py-8">
      <SoldiersLogo />
      <p className="eyebrow mt-8">LGPD</p>
      <h1 className="mt-2 text-3xl">Política de privacidade</h1>
      <p className="mt-3 text-xs text-muted-foreground">
        Texto de produto, alinhado ao que o app realmente coleta. Não é parecer jurídico certificado.
      </p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">Conta.</strong> E-mail e senha (Supabase Auth). O aparelho
          (device) é só um canal, não a pessoa.
        </p>
        <p>
          <strong className="text-foreground">Loja Soldiers.</strong> Buscamos o cliente Shopify pelo e-mail
          do cadastro: nome comercial, tags, pedidos pagos, produtos e validade de 40 dias. Não importamos
          telefone, CPF, endereço completo nem snapshot bruto da loja.
        </p>
        <p>
          <strong className="text-foreground">Uso do app.</strong> Perfil (objetivo, rotina, equipamentos),
          peso e medidas (para nutrição e cargas — não saem no social), treinos, refeições, check-ins,
          suplementos, eventos de produto e preferências de notificação.
        </p>
        <p>
          <strong className="text-foreground">Push.</strong> Se você autorizar, guardamos o endpoint Web Push
          para treino do dia, streak, desafio e kudos — com teto de 3 envios por dia.
        </p>
        <p>
          <strong className="text-foreground">Seus direitos.</strong> No Perfil você baixa um JSON com seus
          dados e pode apagar o que está no servidor do app. Pedidos Shopify não são apagados por aqui.
        </p>
      </div>
      <Link to="/cadastro" className="mt-8 inline-block text-sm font-semibold text-primary">
        Voltar ao cadastro
      </Link>
    </div>
  );
}
