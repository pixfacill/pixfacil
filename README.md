# Mercado Alternativo — Pix no caixa

PWA em Next.js para gerar cobranças Pix com valor definido nos caixas e acompanhar o histórico. O sistema suporta vários caixas, links separados para o operador e para a tela do cliente, auditoria do proprietário e retenção configurável. O QR Pix pode ser exibido no operador e em uma tela separada; a confirmação do pagamento é manual.

No iPhone, abra o endereço publicado no Safari, toque em **Compartilhar > Adicionar à Tela de Início**. O painel ADM e cada caixa têm manifestos e identificadores PWA separados, então podem ser instalados como apps diferentes, inclusive mais de um caixa no mesmo aparelho. Para instalar um caixa, abra no Safari o link secreto daquele operador e, sem editar ou limpar o endereço, use **Compartilhar > Adicionar à Tela de Início**. O primeiro início do app instalado usa esse vínculo e remove o token da barra de endereço. Trate o link como uma credencial e não o compartilhe fora do operador responsável. O app usa um ícone Apple Touch de 180 × 180 px e abre em modo de aplicativo.

## Teste local sem Supabase

No PowerShell, na pasta do projeto:

```powershell
npm install
npm run dev
```

Abra `http://localhost:3000/caixa`. Sem variáveis Supabase, o app usa dados locais deste navegador. Cadastre uma chave de teste em **Menu > Cadastrar chaves Pix**. O modo local não sincroniza dispositivos diferentes.

## Configurar Supabase

1. Abra **SQL Editor > New query** no projeto Supabase.
2. Copie e execute o arquivo completo [`supabase/schema.sql`](./supabase/schema.sql). Ele cria as tabelas, funções, políticas RLS, Realtime e limpeza diária. Em bancos antigos, o script migra as cobranças existentes para “Caixa principal” e preserva o histórico.
3. Em **Authentication > Sign In / Providers**, habilite **Anonymous sign-ins**. Operadores não informam usuário ou senha; o link secreto vincula a sessão anônima ao respectivo caixa.
4. Configure as variáveis abaixo no `.env.local` para desenvolvimento. Para o proprietário, gere `INITIAL_ADMIN_SETUP_KEY` aleatória com pelo menos 32 caracteres.

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
INITIAL_ADMIN_SETUP_KEY=SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
```

O endpoint de configuração inicial aceita também `SUPABASE_URL` e `SUPABASE_ROLE_KEY` como nomes alternativos **somente no servidor**. Portanto, além das três variáveis listadas na sua configuração atual, a criação inicial exige a chave `service_role`/secret do Supabase, definida no servidor como `SUPABASE_ROLE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`. A URL pública e `INITIAL_ADMIN_SETUP_KEY` não podem substituir essa chave administrativa. Para o app no navegador, configure obrigatoriamente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nunca use a chave `service_role`/`SUPABASE_ROLE_KEY` em uma variável `NEXT_PUBLIC_*`.

5. Reinicie o servidor. A URL raiz (`/`) e `/adm` abrem o painel administrativo. Entre com o e-mail e a senha da conta ADM existente; só use **Primeira configuração: criar conta ADM** quando ainda não houver administrador cadastrado. A criação inicial exige o código secreto e uma senha de pelo menos 12 caracteres, e só pode ser feita uma vez. Depois, remova `INITIAL_ADMIN_SETUP_KEY` das variáveis do servidor.
6. Para habilitar recuperação de senha, em **Authentication > URL Configuration > Redirect URLs**, permita `http://localhost:3000/adm` e a URL do seu deploy terminando em `/adm`. Para túneis temporários, permita também `https://*.trycloudflare.com/adm` (o endereço exato muda quando o túnel reinicia). A recuperação usa o provedor de e-mail configurado no Supabase.
7. No login em `/adm`, use **Esqueci minha senha** para enviar o link ao e-mail do proprietário e definir uma senha nova (mínimo 12 caracteres).
8. No painel, abra **Perfil do administrador** para conferir o e-mail, alterar a senha estando conectado ou sair da conta. Ao sair, `/adm` volta a mostrar o login.
9. No **Mercado Alternativo ADM**, cadastre as chaves Pix e crie os caixas. Envie o link individual ao operador responsável. Cada caixa tem link revogável; renovar o link desconecta os dispositivos vinculados ao link anterior. Guarde os links como credenciais.
10. Abra cada terminal em **Caixas** e marque as chaves Pix que aquele caixa pode usar. É possível permitir mais de uma chave por caixa. Desmarcar uma chave remove somente a permissão daquele terminal; a chave continua cadastrada e pode ser marcada novamente. Caixas existentes mantêm inicialmente todas as chaves atuais; caixas novos começam sem chaves liberadas, então selecione ao menos uma antes de compartilhar o link do operador.
11. Em **Caixas**, use **Auditar vendas** para abrir o histórico filtrado daquele terminal, ou **Abrir caixa** para operar um terminal. O relatório soma somente pagamentos confirmados e permite filtrar por caixa, chave Pix e datas.

Se o projeto Supabase já estava instalado, execute as migrations [`20261111_assign_pix_keys_to_cashboxes.sql`](./supabase/migrations/20261111_assign_pix_keys_to_cashboxes.sql) e [`20261112_persist_cashbox_links.sql`](./supabase/migrations/20261112_persist_cashbox_links.sql) no SQL Editor. A primeira cria os vínculos caixa/chave, mantém as chaves atuais disponíveis nos caixas existentes e atualiza as policies RLS para impedir cobranças com chave não liberada. A segunda armazena os links dos operadores em uma tabela protegida por RLS, acessível somente ao proprietário; caixas antigos não têm o segredo recuperável e precisam ter o link renovado uma vez. Se o app retornar que a coluna `excluido` não existe ao salvar as chaves de um caixa, execute [`20261113_ensure_cashbox_excluded_column.sql`](./supabase/migrations/20261113_ensure_cashbox_excluded_column.sql) no SQL Editor; essa correção não altera nem apaga caixas ou chaves. Para permitir que um caixa cancele somente cobranças pendentes, execute [`20261114_allow_cancel_pending_charges.sql`](./supabase/migrations/20261114_allow_cancel_pending_charges.sql). Para restaurar o link separado e somente de leitura da tela do cliente, execute também [`20261115_restore_customer_display_link.sql`](./supabase/migrations/20261115_restore_customer_display_link.sql). Para habilitar a exclusão de chaves Pix sem histórico, execute [`20261116_allow_owner_delete_unused_pix_keys.sql`](./supabase/migrations/20261116_allow_owner_delete_unused_pix_keys.sql); chaves vinculadas a cobranças são protegidas pelo banco e não podem ser apagadas. Em instalação nova, o [`supabase/schema.sql`](./supabase/schema.sql) já inclui tudo.

Os links dos operadores ficam guardados em `caixa_links`, e os links da tela do cliente em `caixa_display_links`; somente o proprietário pode consultá-los. O link do cliente tem um token separado e só pode ler a cobrança pendente daquele caixa, sem permitir operar o terminal. Arquivar ou remover um caixa desativa ambos os links. No detalhe do caixa, os dois links ficam juntos em **Links do caixa**, junto das seções **Chaves Pix**, **Auditoria** e **Ações**.

**Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador nem a publique.** Ela e `INITIAL_ADMIN_SETUP_KEY` são variáveis exclusivamente de servidor; somente as variáveis `NEXT_PUBLIC_*` podem ser disponibilizadas no cliente. Não crie policies abertas para `anon`: o SQL configura acesso autenticado e RLS, com isolamento por caixa.

## Deploy no Cloudflare Workers

O app Next.js usa o adaptador OpenNext para Cloudflare Workers. Em **Workers & Pages > seu Worker > Settings > Build**, configure:

- **Build command:** `npm run build:cf`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** `/` (raiz do repositório); não configure pasta de publicação.

O arquivo [`wrangler.jsonc`](./wrangler.jsonc) aponta para o Worker gerado e serve os assets estáticos. O build executa `next build` e transforma a saída para Workers; o deploy publica o Worker já compilado.

Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em **Settings > Build > Build variables and secrets** do Worker, pois o Next.js inclui esses valores públicos no bundle do navegador. A chave `anon`/publishable é pública; nunca coloque a `service_role` em `NEXT_PUBLIC_*`. Como o administrador já foi criado, não é necessário configurar `INITIAL_ADMIN_SETUP_KEY` nem `SUPABASE_SERVICE_ROLE_KEY`. Se fizer deploy pela linha de comando ou por CI próprio, autentique o Wrangler com `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` como secrets de build.

Para testar localmente no runtime Worker, mantenha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local` durante o build e, se precisar de valores em runtime, copie `.dev.vars.example` para `.dev.vars`. Execute `npm run preview`. O `.env.local` e `.dev.vars` são locais e não devem ser enviados ao Git. Para deploy local autenticado, use `npm run deploy`.

Depois que o domínio `workers.dev` estiver disponível, adicione o endereço de `/adm` em **Supabase > Authentication > URL Configuration > Redirect URLs** para a recuperação de senha.

## Deploy alternativo na Netlify

O arquivo [`netlify.toml`](./netlify.toml) permanece para deploys na Netlify, usando `npm run build` e o plugin oficial do Next.js. Configure somente as variáveis públicas do Supabase para o funcionamento normal do app.

## Teste local pelo Cloudflare Tunnel

Para testar pelo túnel, o servidor local também precisa ter `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`; variáveis configuradas somente em um provedor de deploy não chegam ao computador local. Depois de criar ou mudar essas variáveis, gere novamente o build e reinicie o servidor local. A configuração do Next.js permite `*.trycloudflare.com` no servidor de desenvolvimento/HMR. Inicie/reinicie o túnel apontando para `http://localhost:3000` e abra `/adm`. A sessão do Supabase é vinculada à origem do navegador: se o endereço temporário do túnel mudar, entre novamente no endereço novo. Essa permissão é somente para desenvolvimento e não substitui autenticação; o endereço temporário fica acessível publicamente enquanto estiver ativo.

Se o app não conseguir conectar, a tela mostra um erro e oferece **Tentar novamente** (em vez de ficar carregando sem fim). Confira se as duas variáveis públicas estão configuradas no ambiente de build do provedor e se o schema/migrations foram executados no mesmo projeto Supabase. A inicialização e o carregamento dos dados têm limite de tempo; se o erro persistir, teste `/caixa` no domínio e confira o log do navegador sem compartilhar chaves ou tokens.

## Histórico e retenção

O proprietário acessa `/adm` para filtrar o histórico por caixa, chave Pix e datas e consultar totais recebidos por terminal e chave. Cobranças pendentes canceladas ou substituídas são apagadas e não aparecem no histórico; pagamentos confirmados são preservados para auditoria. Arquivar ou remover um caixa revoga seu link e apaga suas cobranças pendentes, sem apagar pagamentos confirmados. A retenção remota é global, configurada no painel ADM, e a limpeza roda diariamente às 04:00 UTC.

Ao reaplicar [`supabase/schema.sql`](./supabase/schema.sql), cancelamentos antigos também são removidos e a tabela passa a aceitar somente os estados `pendente` e `pago`.

O prazo padrão é 60 dias. Para mudar o valor inicial, ajuste o `60` inserido em `configuracoes_sistema` no [`supabase/schema.sql`](./supabase/schema.sql); depois da instalação, altere o prazo pelo menu do app. O cron lê o valor configurado no banco.

## Sobre o QR Pix

O QR contém um payload Pix EMV com valor fixo, chave e TxID; isso não cria uma cobrança dinâmica registrada por um banco/PSP. Confirme o crédito no aplicativo bancário antes de marcar como pago. Confirmação automática exige integração com o PSP que recebe os pagamentos.
