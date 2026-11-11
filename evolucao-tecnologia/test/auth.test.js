'use strict';
// Testes automáticos (npm test). Usam o Node puro: sem internet e sem enviar e-mail de verdade.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createStore } = require('../src/store');

const PASS = 'Senha1234';
async function boot() {
  const mails = [], clock = { t: Date.now() };
  const app = createApp({
    store: createStore(null), mailer: { async send(m) { mails.push(m); } },
    config: { BASE_URL: 'http://localhost', NODE_ENV: 'test', now: () => clock.t }
  });
  await new Promise((r) => app.server.listen(0, r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = (p, body, { cookie, headers } = {}) => fetch(base + p, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const close = () => { app.server.closeAllConnections(); app.server.close(); };
  return { app, base, mails, clock, call, close };
}
const tokenOf = (mail) => new URL(mail.text.match(/https?:\S+/)[0]).searchParams.get('token');
const signup = (t, extra = {}) => t.call('/api/register', { name: 'Ana Lima', email: 'ana@exemplo.com', password: PASS, ...extra });
const cookieOf = (res) => res.headers.get('set-cookie').split(';')[0];

test('cadastro guarda só o hash e envia confirmação', async () => {
  const t = await boot();
  assert.equal((await signup(t)).status, 202);
  assert.equal(t.mails.length, 1);
  assert.ok(!JSON.stringify(t.app.store.data).includes(PASS), 'a senha não pode aparecer no armazenamento');
  assert.match(t.app.store.data.users['ana@exemplo.com'].pass, /^scrypt\$/);
  t.close();
});

test('cadastro com e-mail repetido responde igual e não reenvia', async () => {
  const t = await boot();
  const a = await (await signup(t)).json(), b = await (await signup(t)).json();
  assert.deepEqual(a, b);
  assert.equal(t.mails.length, 1);
  t.close();
});

test('rejeita senha fraca e e-mail inválido', async () => {
  const t = await boot();
  assert.equal((await signup(t, { password: 'curta1' })).status, 400);
  assert.equal((await signup(t, { password: 'somenteletras' })).status, 400);
  assert.equal((await signup(t, { email: 'invalido' })).status, 400);
  t.close();
});

test('link de confirmação é de uso único', async () => {
  const t = await boot();
  await signup(t);
  const token = tokenOf(t.mails[0]);
  assert.equal((await t.call('/api/confirm?token=' + token)).headers.get('location'), '/?confirmado=1');
  assert.equal(t.app.store.data.users['ana@exemplo.com'].verified, true);
  assert.equal((await t.call('/api/confirm?token=' + token)).headers.get('location'), '/?confirmacao=invalida');
  t.close();
});

test('login cria sessão com cookie seguro e logout a encerra', async () => {
  const t = await boot();
  await signup(t);
  const res = await t.call('/api/login', { email: 'ANA@exemplo.com', password: PASS });
  assert.equal(res.status, 200);
  const raw = res.headers.get('set-cookie');
  assert.match(raw, /HttpOnly/); assert.match(raw, /SameSite=Strict/);
  const cookie = cookieOf(res);
  assert.equal((await t.call('/api/me', undefined, { cookie })).status, 200);
  await t.call('/api/logout', {}, { cookie });
  assert.equal((await t.call('/api/me', undefined, { cookie })).status, 401);
  t.close();
});

test('erro de login é igual para e-mail inexistente e senha errada', async () => {
  const t = await boot();
  await signup(t);
  const a = await t.call('/api/login', { email: 'ana@exemplo.com', password: 'Errada123' });
  const b = await t.call('/api/login', { email: 'ninguem@exemplo.com', password: 'Errada123' });
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.deepEqual(await a.json(), await b.json());
  t.close();
});

test('5 erros bloqueiam o login, mesmo com a senha certa, até passar 15 minutos', async () => {
  const t = await boot();
  await signup(t);
  for (let i = 0; i < 5; i++) await t.call('/api/login', { email: 'ana@exemplo.com', password: 'Errada123' });
  assert.equal((await t.call('/api/login', { email: 'ana@exemplo.com', password: PASS })).status, 429);
  t.clock.t += 16 * 60e3;
  assert.equal((await t.call('/api/login', { email: 'ana@exemplo.com', password: PASS })).status, 200);
  t.close();
});

test('recuperação: vai para e-mail principal e de backup, uso único, derruba sessões', async () => {
  const t = await boot();
  await signup(t, { backup: 'backup@exemplo.com' });
  const cookie = cookieOf(await t.call('/api/login', { email: 'ana@exemplo.com', password: PASS }));
  await t.call('/api/forgot', { email: 'ana@exemplo.com' });
  const mail = t.mails.at(-1);
  assert.match(mail.to, /ana@exemplo.com/); assert.match(mail.to, /backup@exemplo.com/);
  const token = tokenOf(mail);
  assert.equal((await t.call('/api/reset', { token, password: 'fraca' })).status, 400); // senha fraca não gasta o token
  assert.equal((await t.call('/api/reset', { token, password: 'NovaSenha99' })).status, 200);
  assert.equal((await t.call('/api/reset', { token, password: 'OutraSenha99' })).status, 400); // já usado
  assert.equal((await t.call('/api/me', undefined, { cookie })).status, 401);
  assert.equal((await t.call('/api/login', { email: 'ana@exemplo.com', password: PASS })).status, 401);
  assert.equal((await t.call('/api/login', { email: 'ana@exemplo.com', password: 'NovaSenha99' })).status, 200);
  t.close();
});

test('link de recuperação expira em 30 minutos', async () => {
  const t = await boot();
  await signup(t);
  await t.call('/api/forgot', { email: 'ana@exemplo.com' });
  const token = tokenOf(t.mails.at(-1));
  t.clock.t += 31 * 60e3;
  assert.equal((await t.call('/api/reset', { token, password: 'NovaSenha99' })).status, 400);
  t.close();
});

test('recuperação não revela se o e-mail existe', async () => {
  const t = await boot();
  const r = await t.call('/api/forgot', { email: 'ninguem@exemplo.com' });
  assert.equal(r.status, 200);
  assert.equal(t.mails.length, 0);
  t.close();
});

test('cabeçalhos de segurança estão presentes', async () => {
  const t = await boot();
  const h = (await t.call('/')).headers;
  assert.match(h.get('content-security-policy'), /default-src 'self'/);
  assert.equal(h.get('x-content-type-options'), 'nosniff');
  assert.equal(h.get('x-frame-options'), 'DENY');
  assert.equal(h.get('referrer-policy'), 'no-referrer');
  t.close();
});

test('bloqueia POST de outro site e corpo que não seja JSON', async () => {
  const t = await boot();
  const evil = await t.call('/api/login', { email: 'a@b.co', password: PASS }, { headers: { Origin: 'https://site-malicioso.example' } });
  assert.equal(evil.status, 403);
  const res = await fetch(t.base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  assert.equal(res.status, 415);
  t.close();
});

test('não serve arquivos fora da lista pública', async () => {
  const t = await boot();
  assert.equal((await t.call('/../package.json')).status, 404);
  assert.equal((await t.call('/src/app.js')).status, 404);
  t.close();
});
