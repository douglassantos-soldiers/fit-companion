import { createFileRoute, Link } from "@tanstack/react-router";
import { SoldiersLogo } from "@/components/soldiers-logo";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Soldiers Training" },
      { name: "description", content: "Como o app Soldiers Training funciona e o que você aceita ao criar conta." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-5 py-8">
      <SoldiersLogo />
      <p className="eyebrow mt-8">Legal</p>
      <h1 className="mt-2 text-3xl">Termos de uso</h1>
      <p className="mt-3 text-xs text-muted-foreground">
        Texto de produto. Não é parecer jurídico certificado. Atualizado em setembro de 2026.
      </p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          O Soldiers Training é um companion da loja Soldiers: treino, nutrição prática, coach e desafios. O
          acesso ao app depende de uma compra paga na loja nos últimos 40 dias, no mesmo e-mail da conta.
        </p>
        <p>
          Você se cadastra com e-mail e senha. Esse e-mail é o identificador na loja. Sem compra recente, a
          conta existe, mas o treino fica bloqueado até uma nova compra no mesmo endereço.
        </p>
        <p>
          O app sugere treinos e refeições com base no que você informa. Não substitui profissional de saúde,
          nutricionista ou médico. Peso e medidas não são dados clínicos.
        </p>
        <p>
          Pedidos, reembolsos e entrega continuam na loja Soldiers (Shopify). Apagar dados no app não apaga
          pedidos da loja.
        </p>
      </div>
      <Link to="/cadastro" className="mt-8 inline-block text-sm font-semibold text-primary">
        Voltar ao cadastro
      </Link>
    </div>
  );
}
