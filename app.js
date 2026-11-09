// Heloísa Garcia — prévia conceitual (Bruno Luque).
// Três camadas de motion:
//  Assinatura: a caixa que se abre (fita, tampa, cartões do dia), ligada à rolagem com molas nos detentes.
//  Narrativa:  o fio dourado que atravessa a página, o desenho da fita em "Presente", o laço do contato.
//  Interface:  fita que se estica nos botões, pílula dos chips, confirmação de cópia.
// O conteúdo funciona sem este arquivo: os estados escondidos só existem depois que o Motion carrega.

const root = document.documentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const narrowMQ = matchMedia('(max-width: 860px)');
const reduce = reduceMQ.matches;
if (reduce) root.classList.add('reduce');

// tokens de motion
const EASE_OUT = [0.23, 1, 0.32, 1];
const EASE_IN_OUT = [0.77, 0, 0.175, 1];
const SPRING = { lid: { k: 70, c: 11.5 }, ribbon: { k: 120, c: 17 }, cards: { k: 150, c: 25 } };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* Mola escalar interrompível (velocidade preservada; só roda em movimento) */
/* ------------------------------------------------------------------ */
function spring(x0, { k, c }, onUpdate) {
  let x = x0, v = 0, target = x0, raf = 0, last = 0;
  const tick = (t) => {
    const dt = Math.min(0.032, (t - (last || t)) / 1000 || 0.016); last = t;
    v += (-k * (x - target) - c * v) * dt; x += v * dt;
    if (Math.abs(x - target) < 0.0008 && Math.abs(v) < 0.001) { x = target; v = 0; raf = 0; last = 0; onUpdate(x); return; }
    onUpdate(x); raf = requestAnimationFrame(tick);
  };
  return {
    to(n) { if (n === target && !raf) return; target = n; if (!raf) raf = requestAnimationFrame(tick); },
    set(n) { cancelAnimationFrame(raf); raf = 0; last = 0; x = target = n; v = 0; onUpdate(x); },
    stop() { cancelAnimationFrame(raf); raf = 0; last = 0; },
  };
}

/* ------------------------------------------------------------------ */
/* Topo                                                                 */
/* ------------------------------------------------------------------ */
const top = $('[data-top]');
const onScrollTop = () => top.classList.toggle('is-solid', scrollY > 24);
addEventListener('scroll', onScrollTop, { passive: true }); onScrollTop();

/* ------------------------------------------------------------------ */
/* Rolagem contínua (só roda do mouse; toque nativo)                     */
/* ------------------------------------------------------------------ */
let lenis = null;
function startLenis() {
  if (reduce || !window.Lenis || lenis) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  const raf = (t) => { if (!lenis) return; lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
if (window.Lenis) startLenis(); else addEventListener('load', startLenis, { once: true });
reduceMQ.addEventListener('change', () => { if (reduceMQ.matches && lenis) { lenis.destroy(); lenis = null; } });

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const target = id === '#inicio' ? document.body : $(id);
  if (!target) return;
  e.preventDefault();
  const offset = id === '#inicio' ? 0 : id === '#dia' ? 0 : -(top.offsetHeight + 4);
  if (lenis) lenis.scrollTo(id === '#inicio' ? 0 : target, { offset, duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else scrollTo({ top: id === '#inicio' ? 0 : target.getBoundingClientRect().top + scrollY + offset, behavior: reduce ? 'auto' : 'smooth' });
  if (id !== '#inicio') { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
});

/* ------------------------------------------------------------------ */
/* Pílula dos chips (mola, interrompível)                                */
/* ------------------------------------------------------------------ */
let animateFn = null; // preenchido quando o Motion carrega
function makePill(container, getActive) {
  const pill = $('[data-pill]', container);
  if (!pill) { container.classList.add('no-pill'); return () => {}; }
  let placed = false;
  return (animated) => {
    const el = getActive();
    if (!el) return;
    const r = el.getBoundingClientRect(), pr = container.getBoundingClientRect();
    const to = { x: r.left - pr.left - container.clientLeft, y: r.top - pr.top - container.clientTop, w: r.width, h: r.height };
    if (!animated || !animateFn || reduce || !placed) {
      Object.assign(pill.style, { width: to.w + 'px', height: to.h + 'px', transform: `translate(${to.x}px, ${to.y}px)`, opacity: 1 });
      placed = true; return;
    }
    animateFn(pill, { transform: `translate(${to.x}px, ${to.y}px)`, width: to.w + 'px', height: to.h + 'px' }, { type: 'spring', bounce: 0.2, duration: 0.45 });
  };
}

/* ------------------------------------------------------------------ */
/* Cuidados: abas com teclado                                            */
/* ------------------------------------------------------------------ */
const tabsEl = $('[data-tabs]');
const tabs = $$('.chip[role="tab"]', tabsEl);
const panels = $$('.panel');
let activeTab = 0;
const placeTabsPill = makePill(tabsEl, () => tabs[activeTab]);
function pickTab(i, { focus = false } = {}) {
  if (i === activeTab) { if (focus) tabs[i].focus(); return; }
  const prev = panels[activeTab];
  tabs[activeTab].setAttribute('aria-selected', 'false'); tabs[activeTab].tabIndex = -1;
  activeTab = i;
  tabs[i].setAttribute('aria-selected', 'true'); tabs[i].tabIndex = 0;
  if (focus) tabs[i].focus();
  prev.hidden = true; prev.classList.remove('is-active');
  const next = panels[i];
  next.hidden = false; next.classList.add('is-active');
  placeTabsPill(true);
  if (animateFn && !reduce) {
    const vis = $('.panel__vis', next), tx = $('.panel__tx', next);
    animateFn(vis, { clipPath: ['inset(0 0 100% 0 round 6px)', 'inset(0 0 0% 0 round 6px)'] }, { duration: 0.6, ease: EASE_OUT });
    const im = $('img', vis);
    if (im) animateFn(im, { transform: ['scale(1.12)', 'scale(1)'] }, { duration: 0.9, ease: EASE_OUT });
    animateFn(tx, { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0)'] }, { duration: 0.45, delay: 0.1, ease: EASE_OUT });
    $$('.wv', vis).forEach((p, n) => p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1100, delay: 120 + n * 90, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' }));
  }
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => pickTab(i));
  t.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); pickTab((i + 1) % tabs.length, { focus: true }); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); pickTab((i - 1 + tabs.length) % tabs.length, { focus: true }); }
    else if (k === 'Home') { e.preventDefault(); pickTab(0, { focus: true }); }
    else if (k === 'End') { e.preventDefault(); pickTab(tabs.length - 1, { focus: true }); }
  });
});

/* ------------------------------------------------------------------ */
/* Contato: compositor de mensagem + copiar                              */
/* ------------------------------------------------------------------ */
const WA = 'https://wa.me/5548999992095';
const MSG = {
  'Day Spa': 'Olá, Heloísa! Gostaria de saber a disponibilidade do Day Spa.',
  'Drenagem linfática': 'Olá, Heloísa! Gostaria de saber a disponibilidade para drenagem linfática.',
  'Massagem': 'Olá, Heloísa! Gostaria de saber a disponibilidade para massagem.',
  'Presente': 'Olá, Heloísa! Gostaria de saber sobre o cartão presente.',
};
const composer = $('[data-composer]');
const chipsForm = $('[data-chips]');
const preview = $('[data-preview]');
const openBtn = $('[data-open]');
const copyBtn = $('[data-copy]');
const placeFormPill = makePill(chipsForm, () => $('input:checked', chipsForm)?.nextElementSibling?.parentElement);
const currentMsg = () => MSG[$('input:checked', chipsForm)?.value] || 'Olá, Heloísa! Gostaria de saber a disponibilidade para um atendimento.';
function syncMsg() {
  const msg = currentMsg();
  preview.textContent = msg;
  openBtn.href = `${WA}?text=${encodeURIComponent(msg)}`;
}
composer.addEventListener('change', () => { syncMsg(); placeFormPill(true); });
composer.addEventListener('submit', (e) => e.preventDefault());
let copyTimer = 0;
copyBtn.addEventListener('click', async () => {
  const msg = currentMsg();
  let ok = false;
  try { await navigator.clipboard.writeText(msg); ok = true; } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = msg; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
  }
  const label = $('[data-copy-t]', copyBtn), status = $('[data-copy-status]');
  clearTimeout(copyTimer);
  if (ok) { copyBtn.classList.add('is-done'); label.textContent = 'Mensagem copiada'; status.textContent = 'Mensagem copiada.'; }
  else { label.textContent = 'Copie manualmente'; status.textContent = 'Não foi possível copiar; selecione o texto da mensagem.'; }
  copyTimer = setTimeout(() => { copyBtn.classList.remove('is-done'); label.textContent = 'Copiar mensagem'; status.textContent = ''; }, 2400);
});
// "Escolher este cuidado" nos painéis leva a escolha ao compositor
$$('[data-pick]').forEach((a) => a.addEventListener('click', () => {
  const input = $$('input', chipsForm).find((i) => i.value === a.dataset.pick);
  if (input) { input.checked = true; syncMsg(); placeFormPill(true); }
}));
const placeAllPills = () => { placeTabsPill(false); placeFormPill(false); };
addEventListener('resize', placeAllPills);
document.fonts?.ready.then(placeAllPills);
placeAllPills(); syncMsg();

/* ------------------------------------------------------------------ */
/* Botão fixo do celular                                                */
/* ------------------------------------------------------------------ */
const fab = $('[data-fab]');
if (fab && 'IntersectionObserver' in window) {
  const hide = new Set();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? hide.add(e.target) : hide.delete(e.target)));
    fab.classList.toggle('is-on', hide.size === 0);
  }, { threshold: 0.12 });
  fab.classList.remove('is-on');
  [$('[data-hero]'), $('#contato'), $('.foot'), $('#dia')].forEach((s) => { if (s) io.observe(s); });
}

/* ------------------------------------------------------------------ */
/* Motion                                                               */
/* ------------------------------------------------------------------ */
// Motion 11.11.17 (UMD local em vendor/, global `Motion`); módulos rodam depois dos scripts defer.
const M = window.Motion || null;
if (!M) console.warn('Motion indisponível; página segue estática.');

const prog = (p) => (typeof p === 'number' ? p : p?.y?.progress ?? 0);

/* Fio dourado: marcadores nas seções e preenchimento pela rolagem */
function setupThread() {
  const thread = $('[data-thread]'), fill = $('[data-thread-fill]');
  if (!thread) return;
  const main = thread.parentElement;
  const secs = $$('[data-marker]');
  const marks = secs.map(() => { const m = document.createElement('i'); m.className = 'thread__m'; thread.appendChild(m); return m; });
  let tops = [];
  const place = () => { tops = secs.map((s) => s.getBoundingClientRect().top + scrollY - main.getBoundingClientRect().top - scrollY); marks.forEach((m, i) => (m.style.top = tops[i] + 28 + 'px')); };
  let queued = false;
  const update = () => {
    queued = false;
    const mTop = main.getBoundingClientRect().top + scrollY;
    const y = scrollY + innerHeight * 0.55 - mTop;
    fill.style.transform = `scaleY(${clamp(y / main.offsetHeight).toFixed(4)})`;
    marks.forEach((m, i) => m.classList.toggle('is-on', y > tops[i] + 28));
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  place(); update();
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', () => { place(); queue(); });
  document.fonts?.ready.then(() => { place(); queue(); });
  addEventListener('load', () => { place(); queue(); });
}
setupThread();

if (M) {
  const { animate, scroll, inView, stagger } = M;
  animateFn = (...a) => animate(...a);

  if (reduce) {
    root.classList.add('motion-ready');
  } else {
    root.classList.add('motion-ready');

    /* ---- Interface: o laço do contato e a fita de "Presente" começam apagados ---- */
    const loop = $('[data-loop]');
    const giftPath = $('[data-gift-path]');
    [loop, giftPath].forEach((p) => { if (p) { p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; } });

    /* ---- HERO: entrada (texto não espera a cena) ---- */
    animate('.hero__title .line > span', { transform: ['translateY(108%)', 'translateY(0%)'] }, { duration: 1.05, delay: stagger(0.1), ease: EASE_OUT });
    animate('.hero .eyebrow', { opacity: [0, 1] }, { duration: 0.8 });
    animate('.hero__lead, .hero__actions, .hero__place, .hero__cue', { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0px)'] }, { duration: 0.85, delay: stagger(0.08, { startDelay: 0.35 }), ease: EASE_OUT });
    animate('.hero__oval', { opacity: [0, 1], transform: ['translateY(26px) scale(.94)', 'translateY(0px) scale(1)'] }, { duration: 1.1, delay: 0.7, ease: EASE_OUT });
    animate('.hero__seal', { opacity: [0, 1], transform: ['rotate(-26deg) scale(.6)', 'rotate(-8deg) scale(1)'] }, { type: 'spring', bounce: 0.35, duration: 0.9, delay: 1.1 });
    // a caixa assenta; fita em cruz se estende; o laço abre (SVG: WAAPI direto)
    const eo = 'cubic-bezier(0.23, 1, 0.32, 1)';
    const lid = $('.hbox__lid');
    lid?.animate([{ transform: 'translateY(30px) scale(.93)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1200, delay: 150, easing: eo, fill: 'backwards' });
    const hv = $('.hrb--v'), hh = $('.hrb--h');
    if (hv) { hv.style.transformOrigin = '50% 0%'; hv.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 900, delay: 500, easing: eo, fill: 'backwards' }); }
    if (hh) { hh.style.transformOrigin = '0% 50%'; hh.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 650, easing: eo, fill: 'backwards' }); }
    $('.hbox__pop')?.animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1) rotate(0deg)' }], { duration: 900, delay: 1100, easing: 'cubic-bezier(0.34, 1.5, 0.64, 1)', fill: 'backwards' });

    // pausa o respirar da fita quando o hero sai da tela
    const art = $('[data-hero-art]');
    if (art && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => art.classList.toggle('is-paused', !e.isIntersecting), { threshold: 0.05 }).observe(art);
    }
    // saída ligada à rolagem: a caixa se afasta devagar
    scroll((p) => {
      const t = prog(p);
      art.style.transform = `translateY(${(t * -36).toFixed(1)}px) rotate(${(t * -3).toFixed(2)}deg)`;
    }, { target: $('[data-hero]'), offset: ['start start', 'end start'] });

    /* ---- ASSINATURA: Desamarrar ---- */
    const scene = $('[data-scene]'), stage = $('[data-stage]');
    const cardsBox = $('[data-cards]'), cards = $$('[data-card]');
    const front = $('.f--front');
    const labelN = $('[data-label-n]'), labelT = $('[data-label-t]'), dots = $$('.scene__dots i');
    const setVar = (name, fmt) => (v) => stage.style.setProperty(name, fmt(v));
    const rbSpring = spring(0, SPRING.ribbon, setVar('--rb', (v) => v.toFixed(4)));
    const lidSpring = spring(0, SPRING.lid, setVar('--lid', (v) => v.toFixed(2)));
    const N = cards.length;
    const geo = cards.map(() => ({ fx: 0, fy: 0, s0: 0.5, r: 0, r0: 0 }));
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    let lastCp = 0;
    const applyCards = (cp) => {
      lastCp = cp;
      cards.forEach((card, i) => {
        const local = clamp((cp - i * 0.17) / 0.66);
        if (local >= 0.999) { if (card.style.transform) { card.style.transform = ''; } return; }
        const g = geo[i], t = ease(local);
        card.style.transform = `translate(${(g.fx * (1 - t)).toFixed(1)}px, ${(g.fy * (1 - t)).toFixed(1)}px) rotate(${lerp(g.r0, g.r, t).toFixed(2)}deg) scale(${lerp(g.s0, 1, t).toFixed(3)})`;
      });
    };
    const cardsSpring = spring(0, SPRING.cards, applyCards);
    // posições medidas com o layout final (sem transformação): de dentro da caixa até o lugar de cada cartão
    const measure = () => {
      cards.forEach((c) => (c.style.transform = ''));
      const fr = front.getBoundingClientRect(), br = cardsBox.getBoundingClientRect();
      const cx = fr.left + fr.width / 2, yb = fr.top + fr.height * 0.82;
      cards.forEach((c, i) => {
        const w = c.offsetWidth, h = c.offsetHeight;
        const bx = br.left + c.offsetLeft + w / 2, by = br.top + c.offsetTop + h;
        const off = (i - 1) * fr.width * 0.12;
        const s0 = clamp(Math.min(0.5, (fr.height * 0.78 - 6) / h, (fr.width * 0.8 - Math.abs(off) * 2) / w), 0.2, 0.5);
        const r = parseFloat(getComputedStyle(c).getPropertyValue('--r')) || 0;
        geo[i] = { fx: cx + off - bx, fy: yb - by, s0, r, r0: (i - 1) * 7 };
      });
      applyCards(lastCp);
    };
    measure();
    let mt = 0;
    addEventListener('resize', () => { clearTimeout(mt); mt = setTimeout(measure, 120); });
    document.fonts?.ready.then(measure);
    addEventListener('load', measure);

    let step = -1;
    const onScene = (p) => {
      rbSpring.to(p >= 0.08 ? 1 : 0);         // detente 1: o laço se desfaz
      lidSpring.to(p >= 0.26 ? 104 : 0);      // detente 2: a tampa abre (mola com overshoot discreto)
      cardsSpring.to(clamp((p - 0.36) / 0.5)); // os três tempos sobem de dentro da caixa
      const s = p < 0.08 ? 0 : p < 0.26 ? 1 : p < 0.42 ? 2 : 3;
      if (s !== step) {
        step = s;
        labelN.textContent = String(s + 1);
        labelT.textContent = ['Desamarre o laço', 'A fita se solta', 'A tampa se abre', 'O dia está dentro'][s];
        dots.forEach((d, i) => d.classList.toggle('is-on', i <= s));
      }
    };
    onScene(0);
    const stopScene = scroll((p) => onScene(prog(p)), { target: scene, offset: ['start start', 'end end'] });
    addEventListener('pagehide', () => { stopScene?.(); rbSpring.stop(); lidSpring.stop(); cardsSpring.stop(); }, { once: true });

    /* ---- Narrativa: títulos em máscara, fita de "Presente", imagem que assenta ---- */
    $$('.mask-title').forEach((h) => {
      const sp = $('span', h);
      if (h.getBoundingClientRect().top < innerHeight * 0.85) return;
      sp.style.transform = 'translateY(108%)';
      inView(h, () => { animate(sp, { transform: ['translateY(108%)', 'translateY(0%)'] }, { duration: 1, ease: EASE_OUT }); }, { amount: 0.6 });
    });

    $$('[data-reveal]').forEach((fig) => {
      const img = $('img', fig);
      if (fig.getBoundingClientRect().top < innerHeight * 0.8) return;
      img.style.clipPath = 'inset(100% 0 0 0)'; img.style.transform = 'scale(1.14)';
      inView(fig, () => { animate(img, { clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'], transform: ['scale(1.14)', 'scale(1)'] }, { duration: 1.3, ease: EASE_OUT }); }, { amount: 0.25 });
    });

    if (giftPath && !narrowMQ.matches) {
      scroll((p) => { giftPath.style.strokeDashoffset = (1 - clamp(prog(p) * 1.15)).toFixed(4); }, { target: $('#presente'), offset: ['start 0.85', 'end 0.35'] });
    }

    // o laço de fita fecha em volta do botão quando o contato aparece
    if (loop) {
      inView($('.composer__actions'), () => {
        loop.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1500, delay: 150, easing: eo, fill: 'forwards' });
      }, { amount: 0.8 });
    }
  }
  placeAllPills();
}
