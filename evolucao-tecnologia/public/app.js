'use strict';
const $ = (s) => document.querySelector(s);

/* ---------- Dados da linha do tempo ---------- */
const TIMELINE = [
  { year: 'Cerca de 2,6 milhões de anos atrás', era: 'Pré-história', title: 'Ferramentas de pedra', text: 'Os primeiros hominínios lascam pedras para cortar, raspar e quebrar. É o início da tecnologia humana.' },
  { year: 'Centenas de milhares de anos atrás', era: 'Pré-história', title: 'Domínio do fogo', text: 'O fogo passa a ser controlado: aquece, protege, afasta predadores e permite cozinhar os alimentos.' },
  { year: 'Cerca de 10 000 a.C.', era: 'Pré-história', title: 'Agricultura', text: 'Povos do Crescente Fértil passam a cultivar plantas e domesticar animais. Surgem as primeiras aldeias permanentes.' },
  { year: 'Cerca de 3500 a.C.', era: 'Antiguidade', title: 'Escrita e roda', text: 'Na Mesopotâmia surgem a escrita cuneiforme e a roda, e o conhecimento começa a ser registrado e transportado.' },
  { year: 'Cerca de 1440', era: 'Renascimento', title: 'Prensa de tipos móveis', text: 'Gutenberg aperfeiçoa a impressão na Europa. Livros ficam mais baratos e as ideias circulam muito mais rápido.' },
  { year: '1609', era: 'Idade Moderna', title: 'Telescópio na astronomia', text: 'Galileu aponta o telescópio para o céu e muda a forma como a humanidade enxerga o universo.' },
  { year: '1712', era: 'Revolução Industrial', title: 'Máquina a vapor', text: 'Newcomen constrói a primeira máquina a vapor de uso prático, abrindo caminho para fábricas, trens e navios a vapor.' },
  { year: '1796', era: 'Revolução Industrial', title: 'Primeira vacina', text: 'Edward Jenner demonstra que a vacina contra a varíola protege as pessoas, e a prevenção de doenças ganha base científica.' },
  { year: '1837', era: 'Revolução Industrial', title: 'Telégrafo elétrico', text: 'Mensagens passam a viajar quase instantaneamente por fios, e a comunicação à distância muda para sempre.' },
  { year: '1876', era: 'Revolução Industrial', title: 'Telefone', text: 'A voz humana é transmitida por fios elétricos, aproximando pessoas separadas por grandes distâncias.' },
  { year: '1879', era: 'Revolução Industrial', title: 'Lâmpada elétrica', text: 'A lâmpada incandescente se torna prática, e as cidades e as casas ganham luz elétrica nas décadas seguintes.' },
  { year: 'Cerca de 1895', era: 'Revolução Industrial', title: 'Rádio', text: 'Marconi transmite sinais sem fio, e o rádio logo leva notícias e música a milhões de lares.' },
  { year: '1903', era: 'Século XX', title: 'Primeiro voo motorizado', text: 'Os irmãos Wright realizam o primeiro voo controlado de um avião com motor, e o céu se abre para viagens e transporte.' },
  { year: '1928', era: 'Século XX', title: 'Penicilina', text: 'Alexander Fleming percebe que um fungo elimina bactérias, e o primeiro antibiótico inaugura uma nova era na medicina.' },
  { year: '1946', era: 'Século XX', title: 'ENIAC', text: 'O ENIAC, um dos primeiros computadores eletrônicos de uso geral, ocupa uma sala inteira e faz em segundos contas que levariam dias.' },
  { year: '1947', era: 'Século XX', title: 'Transistor', text: 'O transistor substitui as válvulas e torna possível a eletrônica pequena, rápida e barata: a base dos computadores.' },
  { year: '1957', era: 'Era Espacial', title: 'Primeiro satélite artificial', text: 'O Sputnik 1 é lançado e inaugura a era espacial, que depois traria satélites de comunicação, GPS e previsão do tempo.' },
  { year: '1969', era: 'Era Espacial', title: 'Homem na Lua e ARPANET', text: 'A Apollo 11 leva humanos à Lua. No mesmo ano, a ARPANET conecta os primeiros computadores, precursora da internet.' },
  { year: '1971', era: 'Era Digital', title: 'Microprocessador', text: 'O Intel 4004 coloca um processador inteiro em um único chip e abre caminho para os computadores pessoais.' },
  { year: '1989', era: 'Era Digital', title: 'World Wide Web', text: 'Tim Berners-Lee propõe a Web, e a internet passa a ser acessível a qualquer pessoa com um navegador.' },
  { year: '2007', era: 'Era Digital', title: 'Smartphones', text: 'Com o lançamento do iPhone, os smartphones se popularizam e levam internet, câmera e mapas para o bolso de bilhões de pessoas.' },
  { year: '2012', era: 'Era Digital', title: 'Edição genética com CRISPR', text: 'Cientistas demonstram o CRISPR-Cas9 como ferramenta de edição de DNA, com grande potencial para a medicina.' },
  { year: '2020', era: 'Era Digital', title: 'Vacinas de mRNA', text: 'As primeiras vacinas de mRNA contra a covid-19 são autorizadas em menos de um ano, e a tecnologia abre caminho para novos tratamentos.' },
  { year: '2022', era: 'Era da IA', title: 'IA generativa para todos', text: 'Ferramentas de inteligência artificial capazes de escrever, programar e criar imagens chegam ao grande público.' }
];

/* ---------- Armazenamento local (try/catch: pode estar indisponível) ---------- */

/* ---------- Tema ---------- */
const themeSelect = $('#theme-select');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeSelect.value = theme;
  try { localStorage.setItem('tema', theme); } catch {}
}
themeSelect.addEventListener('change', () => {
  applyTheme(themeSelect.value);
});
themeSelect.value = document.documentElement.dataset.theme || 'padrao';

/* ---------- Linha do tempo: busca, filtro por era e 6 marcos por vez ---------- */
const PAGE = 6;
const list = $('#timeline'), moreBtn = $('#more-btn'), tlStatus = $('#tl-status');
const searchEl = $('#search'), chipsEl = $('#chips'), emptyEl = $('#empty');
const ERAS = [...new Set(TIMELINE.map((t) => t.era))];
let eraFilter = '', query = '', shown = 0;
const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const filtered = () => TIMELINE.filter((t) => (!eraFilter || t.era === eraFilter) && (!query || fold(`${t.title} ${t.text} ${t.year} ${t.era}`).includes(query)));

function renderItem(item) {
  const li = document.createElement('li'); li.tabIndex = -1;
  const meta = document.createElement('div'); meta.className = 'meta';
  const era = document.createElement('span'); era.className = 'era'; era.textContent = item.era;
  const year = document.createElement('span'); year.className = 'year'; year.textContent = item.year;
  meta.append(year, era);
  const h = document.createElement('h3'); h.textContent = item.title;
  const p = document.createElement('p'); p.textContent = item.text;
  li.append(meta, h, p);
  return li;
}
function loadMore(focusNew) {
  const items = filtered();
  const first = list.children.length;
  const frag = document.createDocumentFragment();
  items.slice(shown, shown + PAGE).forEach((it) => frag.append(renderItem(it)));
  list.append(frag);
  shown = list.children.length;
  tlStatus.textContent = items.length ? `${shown} de ${items.length} marcos` : '';
  moreBtn.hidden = shown >= items.length;
  emptyEl.hidden = items.length > 0;
  if (focusNew === true && list.children[first]) list.children[first].focus();
}
function resetList() { shown = 0; list.replaceChildren(); loadMore(); }
function drawChips() {
  chipsEl.replaceChildren(...['', ...ERAS].map((era) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
    b.textContent = era || 'Todas as eras'; b.setAttribute('aria-pressed', String(era === eraFilter));
    b.addEventListener('click', () => { eraFilter = era; drawChips(); resetList(); });
    return b;
  }));
}
searchEl.addEventListener('input', () => { query = fold(searchEl.value.trim()); resetList(); });
$('#clear-btn').addEventListener('click', () => { eraFilter = ''; query = ''; searchEl.value = ''; drawChips(); resetList(); searchEl.focus(); });
moreBtn.addEventListener('click', () => loadMore(true));
drawChips();

/* ---------- Conversa com o servidor ---------- */
// Tudo passa por /api. O cookie de sessão é HttpOnly: o JavaScript nunca consegue lê-lo.
async function api(path, body) {
  const opts = body === undefined ? { credentials: 'same-origin' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  let res;
  try { res = await fetch('/api/' + path, opts); } catch { throw new Error('Sem conexão com o servidor.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Algo deu errado. Tente de novo.');
  return data;
}
// Conferência só por conveniência: o servidor valida tudo de novo.
function passwordProblem(p) {
  if (p.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (p.length > 128) return 'A senha é longa demais.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Use letras e números na senha.';
  return '';
}

/* ---------- Janela de login ---------- */
const authDialog = $('#auth-dialog'), authForm = $('#auth-form');
const authError = $('#auth-error'), authInfo = $('#auth-info');
let mode = 'login', resetToken = null;

const MODES = {
  login:    { title: 'Entrar',          submit: 'Entrar',              links: [['Criar conta', 'register'], ['Esqueci minha senha', 'forgot']] },
  register: { title: 'Criar conta',     submit: 'Criar conta',         links: [['Já tenho conta', 'login']] },
  forgot:   { title: 'Recuperar senha', submit: 'Enviar link',         links: [['Voltar ao login', 'login']] },
  reset:    { title: 'Nova senha',      submit: 'Definir nova senha',  links: [] }
};
function setMode(next) {
  mode = next;
  const cfg = MODES[mode];
  $('#auth-title').textContent = cfg.title;
  $('#auth-submit').textContent = cfg.submit;
  authForm.querySelectorAll('[data-modes]').forEach((el) => { el.hidden = !el.dataset.modes.split(' ').includes(mode); });
  authForm.querySelector('[data-pw-label]').textContent = mode === 'reset' ? 'Nova senha' : 'Senha';
  authForm.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  authForm.password.type = 'password'; $('#show-pw').checked = false;
  $('#auth-links').replaceChildren(...cfg.links.map(([label, target]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => { clearMessages(); setMode(target); });
    return b;
  }));
}
function clearMessages() { authError.hidden = true; authInfo.hidden = true; }
function showInfo(text) { authInfo.textContent = text; authInfo.hidden = false; }
function showAuth(next) {
  clearMessages(); authForm.reset(); setMode(next);
  if (!authDialog.open) authDialog.showModal();
  const first = authForm.querySelector('[data-modes]:not([hidden]) input'); if (first) first.focus();
}
$('#show-pw').addEventListener('change', (e) => { authForm.password.type = e.target.checked ? 'text' : 'password'; });

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();
  const f = Object.fromEntries(new FormData(authForm));
  const btn = $('#auth-submit'); btn.disabled = true;
  try {
    if (mode === 'register') {
      if (!(f.name || '').trim()) throw new Error('Informe seu nome.');
      const problem = passwordProblem(f.password || ''); if (problem) throw new Error(problem);
      const r = await api('register', { name: f.name, email: f.email, backup: f.backup, password: f.password });
      authForm.reset(); showInfo(r.message);
    } else if (mode === 'login') {
      setUser(await api('login', { email: f.email, password: f.password }));
      authDialog.close();
    } else if (mode === 'forgot') {
      showInfo((await api('forgot', { email: f.email })).message);
    } else if (mode === 'reset') {
      const problem = passwordProblem(f.password || ''); if (problem) throw new Error(problem);
      const r = await api('reset', { token: resetToken, password: f.password });
      resetToken = null; authForm.reset(); setMode('login'); showInfo(r.message);
    }
  } catch (err) {
    authError.textContent = err.message; authError.hidden = false;
  } finally { btn.disabled = false; }
});

/* ---------- Sessão e conta ---------- */
const accountBtn = $('#account-btn'), accountDialog = $('#account-dialog'), bannerEl = $('#banner');
let user = null;
function banner(text) { bannerEl.textContent = text; bannerEl.hidden = !text; }
function setUser(u) {
  user = u;
  accountBtn.textContent = u ? u.name.split(' ')[0] : 'Entrar';
  if (u && !u.verified) banner('Confirme seu e-mail pelo link que enviamos para ativar a conta por completo.');
  if (!u) banner('');
}
accountBtn.addEventListener('click', () => {
  if (!user) return showAuth('login');
  $('#acc-name').textContent = user.name; $('#acc-email').textContent = user.email;
  accountDialog.showModal();
});
$('#logout-btn').addEventListener('click', async () => {
  try { await api('logout', {}); } catch {}
  setUser(null); accountDialog.close();
});

document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

/* ---------- Início ---------- */
loadMore();
api('me').then(setUser).catch(() => {});
const params = new URLSearchParams(location.search);
if (location.pathname === '/reset' && params.get('token')) { // veio do link do e-mail
  resetToken = params.get('token'); history.replaceState(null, '', '/'); showAuth('reset');
} else if (params.has('confirmado')) {
  banner('E-mail confirmado! Agora é só entrar.'); history.replaceState(null, '', '/');
} else if (params.has('confirmacao')) {
  banner('Link inválido ou expirado. Crie a conta de novo ou peça outro link.'); history.replaceState(null, '', '/');
}
