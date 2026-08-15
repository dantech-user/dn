# Hydra Agro 5.3

Aplicativo mobile e web original para gestão sustentável rural. A interface usa a identidade aprovada do Hydra Agro, sem sidebar no celular e com navegação inferior fixa.

A marca oficial está em `public/logo.svg` e `assets/logo.svg`. O mesmo desenho é usado no navegador, login, cabeçalho, splash animada, PWA e ícone/splash nativos do Android.

## O que está funcionando

- Cadastro direto sem código por e-mail, login em etapas, sessão persistente e edição da propriedade.
- Splash, criação de conta, entrada e ajuda reunidas em um fluxo visual único.
- Painel com saudação dinâmica, clima, água, rebanho, drones, metas, alertas, pontuação, sequência, tarefas, atividades, dicas, conquistas e dispositivos.
- Central NFC em destaque, com leitura nativa no APK Android, Web NFC no navegador compatível, entrada manual como alternativa, associação da etiqueta ao animal, histórico persistente, cobertura do rebanho e atualização automática da última identificação.
- Água com registros, reservatórios editáveis e gráfico dos últimos dias.
- Drones com cadastro, bateria, status e gerenciamento de missão.
- Desafios com progresso automático e ranking calculado a partir de leituras de água, etiquetas NFC e missões concluídas pelos drones. Não existe botão de progresso manual.
- Comunidade persistente com abas, busca, filtros, posts de texto, foto opcional da câmera/galeria, curtidas, comentários, salvos, compartilhamento, seguidores, perfis de propriedades, edição, exclusão e denúncia.
- Perfil renovado com foto enviada pela câmera/galeria, edição do nome, feed próprio e informações completas da fazenda.
- Modo escuro completo e persistente por conta.
- Painel administrativo exclusivo do dono para avisos de informação, atualização ou manutenção, pesquisa de usuários, banimento/desbanimento, denúncias e registro das ações administrativas.
- Suporte e créditos com `danqxy7@gmail.com` e Instagram `@rlkdn.dev`.
- Planos Gratuito e Hydra Agro Pro, limites aplicados pelo servidor, tela de assinatura e exportação completa para contas Pro.
- Splash nativa Android, splash animada no app, skeletons, bottom sheets, toasts, contadores, gráficos, NFC e animações que respeitam `prefers-reduced-motion`.

As imagens fixas/decorativas da Comunidade foram removidas. Uma foto só aparece quando foi enviada pelo usuário em uma publicação.

Toda conta/fazenda nova começa zerada: não são criados animais, leituras, reservatórios, drones, posts, comentários, curtidas, notificações ou conquistas falsas. Apenas as definições dos desafios são criadas, sempre com progresso `0`.

## Abrir no GitHub Codespaces

1. Envie a pasta completa para um repositório do GitHub.
2. Abra **Code → Codespaces → Create codespace on main**.
3. Aguarde a configuração e execute `npm start` caso o servidor ainda não esteja rodando.
4. Abra a aba **Ports** e publique/abra a porta `4173`.

```bash
npm start
```

## Banco de dados

O app em Codespaces usa SQLite de verdade, criado automaticamente em `data/hydra-agro.sqlite`. As tabelas incluem usuários, sessões, fazendas, animais, leituras NFC, reservatórios, leituras de água, drones, missões concluídas, notificações, posts, curtidas, comentários, salvos, seguidores, denúncias, desafios, configurações, avisos do aplicativo e auditoria administrativa.

Para não perder dados em produção, publique o servidor Node em uma hospedagem com disco persistente e faça backup do arquivo SQLite. O arquivo `supabase/schema.sql` também contém a estrutura PostgreSQL, políticas RLS e Storage para uma futura migração ao Supabase; a versão atual do servidor usa SQLite.

Fotos de perfil e imagens enviadas nas publicações ficam em `public/uploads`. Em produção, esse diretório também precisa de armazenamento persistente ou deve ser substituído por um serviço de objetos.

## Plano Pro e VIP

O e-mail `danqxy7@gmail.com` está na lista VIP e administrativa do banco. Ao cadastrar ou entrar com essa conta, o servidor ativa automaticamente `Hydra Agro Pro`, status ativo, selo VIP vitalício e acesso ao painel do dono. A autorização é validada no servidor; esconder ou exibir o botão na interface não concede permissão administrativa.

No painel do dono, avisos ativos aparecem no topo das telas dos usuários. Ao banir uma conta, o servidor salva o motivo, encerra todas as sessões dela e bloqueia novas entradas até o desbanimento. A conta administrativa não pode banir a si própria nem outra conta administrativa.

O plano Gratuito permite até 50 animais e 2 drones. O Pro remove esses limites e libera a exportação completa dos dados. Para aceitar pagamentos reais, configure `HYDRA_PRO_CHECKOUT_URL`, `HYDRA_PRO_PRICE` e `HYDRA_BILLING_WEBHOOK_SECRET` no servidor. A URL pode usar os marcadores `{email}` e `{user_id}`. Depois do pagamento, o provedor deve chamar `POST /api/billing/webhook` com o header `x-hydra-webhook-secret` e um JSON com `email`, `status`, `provider`, `reference` e `expires_at`. Sem provedor configurado, nenhuma assinatura é marcada como paga.

## Gerar o APK Android

O APK acessa o mesmo servidor HTTPS usado pela versão de navegador. Por isso, antes de gerar, publique o servidor completo — não apenas a pasta `public`.

1. No GitHub, abra **Settings → Secrets and variables → Actions**.
2. Crie o secret `HYDRA_APP_URL` com a URL HTTPS pública do Hydra Agro.
3. Abra **Actions → Gerar APK Hydra Agro → Run workflow**.
4. Ao terminar, baixe `hydra-agro-apk` em **Artifacts**.

O workflow valida o JavaScript, cria o projeto Android, gera ícone e splash nativos, sincroniza o Capacitor e compila `app-debug.apk`.

## Testes rápidos

```bash
npm test
```

Para testar a API completa, inicie o servidor e crie uma conta nova pelo aplicativo. A conta e a propriedade começam sem registros de progresso; os números aumentam apenas quando o usuário cadastra ou registra ações reais.
