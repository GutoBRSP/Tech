'use strict';
// Servidor HTTP: rotas da API, arquivos estáticos e cabeçalhos de segurança. Sem framework.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const sec = require('./security');

const PUBLIC = path.join(__dirname, '..', 'public');
// Lista fechada de arquivos públicos: nada fora dela é servido (sem "../").
const FILES = { '/': 'index.html', '/reset': 'index.html', '/app.js': 'app.js', '/theme-init.js': 'theme-init.js', '/style.css': 'style.css' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;

// CSP restrita: não há scripts nem estilos inline, então nada injetado consegue rodar.
const HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer', // o token do link de recuperação não vaza para outros sites
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const isEmail = (v) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(v);
const normEmail = (v) => String(v).trim().toLowerCase();
function passwordProblem(p) {
  if (p.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (p.length > 128) return 'A senha é longa demais.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Use letras e números na senha.';
  return '';
}

function createApp({ store, mailer, config }) {
  const now = config.now || Date.now;
  const prod = config.NODE_ENV === 'production';
  const limiter = sec.createLimiter(now);
  const db = store.data;
  const dummyHash = sec.hashPassword('senha-falsa-1'); // gasta o mesmo tempo para e-mail inexistente

  const send = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const fail = (res, status, error) => send(res, status, { error });
  const ipOf = (req) => config.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress : req.socket.remoteAddress;
  const mailSafe = async (m) => { try { await mailer.send(m); } catch (e) { console.error('Falha ao enviar e-mail:', e.message); } };
  const cookie = (v, age) => `sid=${v}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${prod ? '; Secure' : ''}`;

  /* ----- Tokens de uso único com validade ----- */
  function issueToken(email, type, ttl) {
    for (const [k, t] of Object.entries(db.tokens)) if (t.expires <= now()) delete db.tokens[k];
    const token = sec.newToken();
    db.tokens[sec.sha(token)] = { email, type, expires: now() + ttl };
    store.save();
    return token;
  }
  function consumeToken(token, type) { // apaga SEMPRE: usou, gastou
    const k = sec.sha(token || '');
    const t = db.tokens[k];
    if (!t) return null;
    delete db.tokens[k]; store.save();
    return t.type === type && t.expires > now() ? t.email : null;
  }

  /* ----- Sessões (cookie HttpOnly + SameSite=Strict) ----- */
  function startSession(res, email) {
    const sid = sec.newToken();
    db.sessions[sec.sha(sid)] = { email, expires: now() + 7 * DAY };
    store.save();
    res.setHeader('Set-Cookie', cookie(sid, 7 * 24 * 3600));
  }
  function sessionOf(req) {
    const m = /(?:^|;\s*)sid=([\w-]+)/.exec(req.headers.cookie || '');
    if (!m) return null;
    const key = sec.sha(m[1]), s = db.sessions[key];
    if (!s) return null;
    if (s.expires <= now() || !db.users[s.email]) { delete db.sessions[key]; store.save(); return null; }
    return { key, user: db.users[s.email] };
  }
  const publicUser = (u) => ({ name: u.name, email: u.email, verified: u.verified });

  function readJson(req) {
    return new Promise((resolve, reject) => {
      const chunks = []; let size = 0;
      req.on('data', (c) => { size += c.length; if (size <= 10000) chunks.push(c); });
      req.on('end', () => {
        if (size > 10000) return reject(Object.assign(new Error('Pedido grande demais.'), { status: 413 }));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); }
      });
      req.on('error', reject);
    });
  }

  async function api(req, res, url) {
    if (req.method === 'POST') {
      // Proteção contra requisições de outros sites (CSRF): origem igual ao site + só JSON
      // (JSON exige "preflight" do navegador, que sites de fora não passam) + cookie SameSite=Strict.
      const origin = req.headers.origin;
      if (origin) { let ok = false; try { ok = new URL(origin).host === req.headers.host; } catch {} if (!ok) return fail(res, 403, 'Origem não permitida.'); }
      if (!/^application\/json/i.test(req.headers['content-type'] || '')) return fail(res, 415, 'Envie os dados em JSON.');
    }
    const ip = ipOf(req);
    switch (req.method + ' ' + url.pathname) {
      case 'POST /api/register': {
        if (!limiter.hit('reg:' + ip, 10, 15 * MIN)) return fail(res, 429, 'Muitas tentativas. Aguarde alguns minutos.');
        const b = await readJson(req);
        const name = String(b.name || '').trim().slice(0, 60), email = normEmail(b.email || ''), backup = b.backup ? normEmail(b.backup) : '';
        const password = String(b.password || '');
        if (!name) return fail(res, 400, 'Informe seu nome.');
        if (!isEmail(email)) return fail(res, 400, 'E-mail inválido.');
        if (backup && !isEmail(backup)) return fail(res, 400, 'E-mail de backup inválido.');
        const problem = passwordProblem(password); if (problem) return fail(res, 400, problem);
        if (!db.users[email]) {
          db.users[email] = { name, email, backup, pass: await sec.hashPassword(password), verified: false, created: now() };
          store.save();
          const token = issueToken(email, 'confirm', DAY);
          await mailSafe({ to: email, subject: 'Confirme seu e-mail', text: `Olá, ${name}!\n\nConfirme seu e-mail (link de uso único, vale por 24 horas):\n${config.BASE_URL}/api/confirm?token=${token}\n\nSe não foi você, ignore esta mensagem.` });
        }
        // Resposta idêntica com e-mail novo ou já cadastrado: ninguém descobre quem tem conta.
        return send(res, 202, { message: 'Pronto! Se os dados forem válidos, enviamos um link de confirmação para o seu e-mail. Depois é só entrar.' });
      }
      case 'POST /api/login': {
        const b = await readJson(req);
        const email = normEmail(b.email || ''), key = `login:${ip}:${email}`;
        if (!limiter.hit('loginip:' + ip, 30, 15 * MIN) || limiter.blocked(key, 5)) return fail(res, 429, 'Muitas tentativas. Aguarde 15 minutos.');
        const u = db.users[email];
        const ok = await sec.verifyPassword(String(b.password || ''), u ? u.pass : await dummyHash);
        if (!u || !ok) { limiter.hit(key, 5, 15 * MIN); return fail(res, 401, 'E-mail ou senha incorretos.'); }
        limiter.clear(key);
        startSession(res, email);
        return send(res, 200, publicUser(u));
      }
      case 'POST /api/logout': {
        const s = sessionOf(req);
        if (s) { delete db.sessions[s.key]; store.save(); }
        res.setHeader('Set-Cookie', cookie('', 0));
        return send(res, 200, { ok: true });
      }
      case 'GET /api/me': {
        const s = sessionOf(req);
        return s ? send(res, 200, publicUser(s.user)) : fail(res, 401, 'Não autenticado.');
      }
      case 'GET /api/confirm': {
        const email = consumeToken(url.searchParams.get('token'), 'confirm');
        if (email && db.users[email]) { db.users[email].verified = true; store.save(); }
        res.writeHead(302, { Location: email ? '/?confirmado=1' : '/?confirmacao=invalida' });
        return res.end();
      }
      case 'POST /api/forgot': {
        if (!limiter.hit('forgot:' + ip, 5, 15 * MIN)) return fail(res, 429, 'Muitas tentativas. Aguarde alguns minutos.');
        const b = await readJson(req);
        const email = normEmail(b.email || ''), u = db.users[email];
        if (u && limiter.hit('forgot:' + email, 3, HOUR)) {
          const token = issueToken(email, 'reset', 30 * MIN);
          const to = [...new Set([u.email, u.backup].filter(Boolean))].join(', '); // principal + backup
          await mailSafe({ to, subject: 'Recuperação de senha', text: `Recebemos um pedido para redefinir sua senha.\n\nLink de uso único, vale por 30 minutos:\n${config.BASE_URL}/reset?token=${token}\n\nSe não foi você, ignore esta mensagem: sua senha continua a mesma.` });
        }
        return send(res, 200, { message: 'Se o e-mail estiver cadastrado, enviamos um link de recuperação (vale por 30 minutos). Veja também o spam.' });
      }
      case 'POST /api/reset': {
        if (!limiter.hit('reset:' + ip, 10, 15 * MIN)) return fail(res, 429, 'Muitas tentativas. Aguarde alguns minutos.');
        const b = await readJson(req);
        const password = String(b.password || '');
        const problem = passwordProblem(password); if (problem) return fail(res, 400, problem); // antes de gastar o token
        const email = consumeToken(b.token, 'reset');
        const u = email && db.users[email];
        if (!u) return fail(res, 400, 'Link inválido ou expirado. Peça um novo.');
        u.pass = await sec.hashPassword(password);
        for (const [k, s] of Object.entries(db.sessions)) if (s.email === email) delete db.sessions[k]; // derruba logins antigos
        store.save();
        return send(res, 200, { message: 'Senha alterada. Entre com a nova senha.' });
      }
      default: return fail(res, 404, 'Não encontrado.');
    }
  }

  function serveStatic(req, res, pathname) {
    const file = FILES[pathname];
    if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado.'); }
    fs.readFile(path.join(PUBLIC, file), (err, buf) => {
      if (err) { res.writeHead(500); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  }

  const server = http.createServer(async (req, res) => {
    for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
    try {
      if (prod) { // só HTTPS em produção
        if (req.headers['x-forwarded-proto'] !== 'https') { res.writeHead(308, { Location: config.BASE_URL + req.url }); return res.end(); }
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
      }
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      serveStatic(req, res, url.pathname);
    } catch (err) {
      if (err.status) return fail(res, err.status, err.message);
      console.error(err); // nunca mostra detalhes do erro ao usuário
      if (!res.headersSent) fail(res, 500, 'Erro interno.');
    }
  });
  return { server, store, limiter };
}
module.exports = { createApp };
