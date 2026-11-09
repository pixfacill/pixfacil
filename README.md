# Mercado Alternativo — Pix no caixa

PWA em Next.js para gerar cobranças Pix com valor definido, exibir o QR Code em `/display` e acompanhar o histórico. O QR Code é montado no navegador; sem Supabase, o app também permite testar o fluxo entre abas do mesmo navegador.

## Rodar para teste

No PowerShell, na pasta do projeto:

```powershell
npm install
npm run dev
```

Abra `http://localhost:3000/caixa`. Para abrir a tela do cliente, use **Abrir display** ou acesse `http://localhost:3000/display`.

Sem variáveis do Supabase, as chaves e o histórico ficam no armazenamento local do navegador. O exemplo inicia com uma chave Pix fictícia: cadastre uma chave de teste em **☰ Administração** antes de tentar pagar.

## Conectar ao Supabase

1. No Supabase, abra **SQL Editor > New query**.
2. Copie e execute todo o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql).
3. Crie um arquivo `.env.local` na raiz (copie `.env.example`) e informe a URL do projeto e a chave `anon`/publishable.
4. Reinicie o servidor (`Ctrl+C` e `npm run dev`).
5. Cadastre uma chave Pix real/de teste em **Administração**. Abra `/display` em outra tela/dispositivo e gere uma cobrança no caixa.

Nunca use a chave `service_role` no navegador. As policies do SQL são abertas para `anon` e existem apenas para facilitar o teste sem login; qualquer pessoa com acesso ao projeto poderá ler ou modificar as chaves e sessões. Proteja o projeto com autenticação e policies por loja/usuário antes de produção.

## Deploy na Netlify

1. Envie esta pasta para um repositório Git e importe o repositório na Netlify.
2. A configuração em [`netlify.toml`](./netlify.toml) usa `npm run build` e o plugin oficial do Next.js; não configure uma pasta de publicação estática.
3. Em **Site configuration > Environment variables**, crie `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores do Supabase. Use a chave pública `anon`/publishable, nunca a `service_role`.
4. Faça o deploy. Depois de alterar variáveis de ambiente, dispare um novo deploy para que sejam incorporadas ao app.
5. Teste `/caixa` e `/display` no domínio publicado. Para sincronização entre dispositivos, ambos precisam usar a mesma configuração Supabase.

## Retenção

O histórico local pode ser configurado no menu de administração. Para registros do Supabase, altere o valor padrão `60` na função `public.limpar_sessoes_pix` em [`supabase/schema.sql`](./supabase/schema.sql) para `90`, por exemplo, e execute novamente o bloco da função e do agendamento. A limpeza remota roda diariamente às 04:00 UTC.

## Sobre o QR Pix

Este app cria localmente um payload Pix EMV com valor fixo, chave e TxID, sem chamar um banco. Isso é útil para testar o fluxo, mas não equivale a uma cobrança dinâmica registrada por um PSP/banco. A confirmação do pagamento é manual e só deve ser feita após verificar o crédito no aplicativo bancário. Confirmação automática e QR dinâmico bancário exigem integração com o PSP que recebe os pagamentos.
