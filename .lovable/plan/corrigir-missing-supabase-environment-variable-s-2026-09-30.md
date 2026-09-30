# Corrigir "Missing Supabase environment variable(s)"

Neste momento, o ambiente da prévia tem SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY, e o registro do servidor não mostra o erro. Então o aviso provavelmente veio de uma configuração antiga que o app ainda estava usando (isso já aconteceu antes) ou do site publicado, que talvez não tenha essas chaves.

## Passos
1. Atualizar de novo a conexão com o Supabase e reiniciar o app.
2. Abrir /entrar e /acesso e conferir que o aviso sumiu.
3. Deixar o app mais resistente a esse problema: onde o servidor lê essas duas chaves (a checagem de login e as telas de acesso/admin), usar como reserva os valores públicos do Supabase que já ficam dentro do app. Assim, se a configuração ficar desatualizada de novo, o app continua funcionando.
4. Se o erro aparecer só no site publicado: publicar de novo depois da correção.

## Detalhes técnicos
- Rodar supabase--rebind_secrets e depois reiniciar o processo do vite.
- auth-middleware.ts é gerado automaticamente e não deve ser editado. Os arquivos access.functions.ts e access-session.server.ts já usam o fallback para VITE_SUPABASE_*. Vou conferir se alguma função do servidor com requireSupabaseAuth é chamada no fluxo de /entrar e /acesso. Se for, troco por um cliente local que usa `process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL`.
