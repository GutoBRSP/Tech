'use strict';
// Envio de e-mail pelo Gmail com "senha de app". Sem configuração (só em desenvolvimento), imprime no terminal.
function createMailer(config) {
  if (!config.GMAIL_USER || !config.GMAIL_APP_PASSWORD) {
    return { async send(m) { console.log(`\n[e-mail simulado] para: ${m.to}\nassunto: ${m.subject}\n${m.text}\n`); } };
  }
  const nodemailer = require('nodemailer'); // carregado só quando necessário
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.GMAIL_USER, pass: config.GMAIL_APP_PASSWORD.replace(/\s/g, '') }
  });
  return { send: (m) => transport.sendMail({ from: `"Evolução & Tecnologia" <${config.GMAIL_USER}>`, ...m }) };
}
module.exports = { createMailer };
