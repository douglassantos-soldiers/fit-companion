# Corrigir o vai-e-volta entre /onboarding e /acesso para o admin

## O que está acontecendo
1. Na tela /acesso, o servidor confirma que o Douglas é admin e responde "liberado". Aí o app abre /onboarding.
2. Em /onboarding, a trava de acesso pergunta de novo ao servidor. O servidor não encontra o "passe" de admin que acabou de entregar e manda o Douglas de volta para /acesso.
3. Na tela /acesso o servidor libera de novo, e o ciclo se repete sem parar.

Causa mais provável (ainda não confirmada): o passe de acesso é um cookie com a regra "SameSite=Lax". A prévia do Lovable roda dentro de um quadro (iframe) em outro site, e ali o navegador descarta esse tipo de cookie. O servidor entrega o passe, mas o navegador não o guarda.

## O que vou mudar
1. **Cookies de acesso e de admin**: quando o endereço for https (prévia e site publicado), gravar com `SameSite=None; Secure`. Assim o navegador aceita o cookie mesmo dentro do quadro da prévia. Em http local continua `Lax`.
2. **Trava contra repetição na trava de acesso**: se o servidor disser "admin liberado" mas o passe ainda não aparecer na conferência seguinte, o app não volta para /acesso. Ele mostra uma mensagem clara ("Não foi possível guardar o acesso neste navegador; abra o app em nova aba"), e o ciclo não se repete.
3. **Tela /acesso**: a liberação de admin roda uma vez só por visita, e não em cada carregamento.

## Como vou verificar
- Abrir o app de verdade pelo navegador automático e conferir os cabeçalhos `Set-Cookie`: os dois cookies devem vir com `SameSite=None; Secure` em https.
- Testar uma chamada ao servidor com o cookie de admin e confirmar que a conferência de acesso responde "ok".
- A entrada completa com a conta do Douglas continua sem teste da minha parte, porque não tenho a senha. Vou dizer isso ao final e pedir que ele teste abrindo o app em nova aba e também na prévia.

## Detalhes técnicos
- `src/lib/access-session.server.ts`: helper `cookieFlags()` que lê o protocolo da requisição (`x-forwarded-proto` / URL) e retorna `{ secure: true, sameSite: "none" }` em https. Usado em `setAccessSessionCookie`, `setAdminSessionCookie` e nos `deleteCookie` correspondentes.
- `src/components/access-gate.tsx`: guardar em `useRef` que o admin já foi liberado; se `checkSession` continuar `!ok` depois disso, mostrar um estado de erro em vez de navegar para /acesso.
- `src/routes/acesso.tsx`: evitar chamar `grantAdmin` de novo no mesmo carregamento e trocar `window.location.assign` pelo `navigate` do router.
