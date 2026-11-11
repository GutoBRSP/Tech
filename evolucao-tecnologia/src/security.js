'use strict';
// Peças de segurança: hash de senha, tokens e limite de tentativas.
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// A senha nunca é guardada: só o resultado do scrypt (com sal aleatório por usuário).
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 32, PARAMS);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
async function verifyPassword(password, stored) {
  const [, s, k] = stored.split('$');
  const want = Buffer.from(k, 'base64');
  const got = await scrypt(password, Buffer.from(s, 'base64'), want.length, PARAMS);
  return crypto.timingSafeEqual(got, want); // comparação em tempo constante
}

const newToken = () => crypto.randomBytes(32).toString('base64url');
// No disco guardamos só o SHA-256 do token: um vazamento do arquivo não revela links válidos.
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

// Limite de tentativas: `now` é injetável para os testes controlarem o relógio.
function createLimiter(now) {
  const m = new Map();
  return {
    hit(key, max, windowMs) { // conta uma tentativa; false = passou do limite
      const t = now();
      let e = m.get(key);
      if (!e || e.reset <= t) { e = { n: 0, reset: t + windowMs }; m.set(key, e); }
      e.n++;
      if (m.size > 10000) for (const [k, v] of m) if (v.reset <= t) m.delete(k);
      return e.n <= max;
    },
    blocked(key, max) { const e = m.get(key); return !!e && e.reset > now() && e.n >= max; },
    clear(key) { m.delete(key); }
  };
}
module.exports = { hashPassword, verifyPassword, newToken, sha, createLimiter };
