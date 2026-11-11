'use strict';
// Armazenamento em arquivo JSON (gravação atômica). Para muitos usuários, troque por um banco de dados:
// só este arquivo precisa mudar, o resto do código usa store.data e store.save().
const fs = require('node:fs');
const path = require('node:path');

function createStore(file) {
  let data = { users: {}, tokens: {}, sessions: {} };
  if (file && fs.existsSync(file)) data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  return {
    data,
    save() {
      if (!file) return; // sem arquivo = só memória (testes)
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
      fs.renameSync(tmp, file);
    }
  };
}
module.exports = { createStore };
