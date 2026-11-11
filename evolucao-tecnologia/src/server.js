'use strict';
// Ponto de entrada: lê o .env, confere a configuração e liga o servidor.
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app');
const { createStore } = require('./store');
const { createMailer } = require('./mailer');

try { // lê o .env sem biblioteca; variáveis já definidas no ambiente têm prioridade
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const env = process.env, port = Number(env.PORT) || 3000;
const config = {
  NODE_ENV: env.NODE_ENV || 'development', PORT: port,
  BASE_URL: (env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  TRUST_PROXY: env.TRUST_PROXY === '1',
  GMAIL_USER: env.GMAIL_USER, GMAIL_APP_PASSWORD: env.GMAIL_APP_PASSWORD
};
if (config.NODE_ENV === 'production') { // produção exige HTTPS e e-mail real
  const erros = [];
  if (!config.BASE_URL.startsWith('https://')) erros.push('BASE_URL precisa começar com https://');
  if (!config.GMAIL_USER || !config.GMAIL_APP_PASSWORD) erros.push('Configure GMAIL_USER e GMAIL_APP_PASSWORD');
  if (erros.length) { console.error('Configuração inválida:\n- ' + erros.join('\n- ')); process.exit(1); }
}
const store = createStore(path.join(__dirname, '..', 'data', 'db.json'));
const { server } = createApp({ store, mailer: createMailer(config), config });
server.listen(port, env.HOST || '127.0.0.1', () => console.log(`Rodando em ${config.BASE_URL} (${config.NODE_ENV})`));
