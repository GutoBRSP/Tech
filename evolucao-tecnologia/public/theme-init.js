// Aplica o tema salvo antes de desenhar a página (evita "piscar").
  try { var t = localStorage.getItem('tema');
    if (!t && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) t = 'claro';
    if (t) document.documentElement.dataset.theme = t; } catch (e) {}
