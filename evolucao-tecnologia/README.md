# Evolução & Tecnologia

Linha do tempo da tecnologia (6 marcos por vez, sem bibliotecas no front-end) com contas de usuário.

## Estrutura
- `src/` back-end: `app.js` (rotas e cabeçalhos), `security.js` (hash, tokens, limite), `store.js` (dados), `mailer.js` (Gmail), `server.js` (início)
- `public/` front-end: `index.html`, `style.css`, `app.js`, `theme-init.js`
- `test/` testes automáticos
- `data/` banco em JSON (não vai para o Git)

## Rodar
1. Instale o Node 20 ou superior
2. `npm install`
3. `npm test`
4. Copie `.env.example` para `.env` e preencha
5. `npm start` e abra http://localhost:3000

Sem `GMAIL_USER`, os e-mails aparecem no terminal (só em desenvolvimento).

## Gmail
Ative a verificação em 2 etapas, crie uma senha de app em myaccount.google.com/apppasswords e ponha em `GMAIL_APP_PASSWORD`.

## Produção
- `NODE_ENV=production`, `BASE_URL=https://seu-site`, `TRUST_PROXY=1` (atrás de proxy HTTPS)
- O servidor se recusa a iniciar sem HTTPS e sem e-mail configurado
- Nunca publique o `.env` nem a pasta `data/`
- Rode `npm audit` e o OWASP ZAP contra o site já em HTTPS antes de divulgar
