// The splash (SPEC §9, Visual style): the logotype over a veil when the app
// opens, the isotype while moving between sections. Loaded by every page.
//
// The cap is a cap, not a wait. The longest the veil may stay is enforced by
// app.css alone, from the first paint (--splash-start-max,
// --splash-section-max), so it holds even when this file is slow to come.
// This file only lifts the veil earlier: as soon as the page has loaded.
// The inline script in the <head> (src/layout.tsx) decides, before the first
// paint, whether this page opens the app or continues a move between
// sections.

const root = document.documentElement;
const veil = document.querySelector('.splash');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// The moment a move between sections started, for the next page's head.
const KEY = 'flowhow-splash';

const leaveMs = () => parseFloat(getComputedStyle(root).getPropertyValue('--splash-leave')) || 0;

function clear() {
  delete root.dataset.splash;
  delete root.dataset.splashCarry;
  root.style.removeProperty('--splash-elapsed');
  veil?.removeAttribute('style');
}

// From wherever the veil is (fading in, waiting), fade it out. With reduced
// motion it simply goes.
function lift() {
  if (!veil || !root.dataset.splash) return;
  const now = getComputedStyle(veil);
  if (reduced.matches || now.visibility === 'hidden') return clear();
  const opacity = now.opacity;
  veil.style.animation = 'none';
  veil.style.opacity = opacity;
  veil.style.pointerEvents = 'none';
  veil.getBoundingClientRect();
  veil.style.transition = 'opacity var(--splash-leave) var(--splash-ease)';
  veil.style.opacity = '0';
  setTimeout(clear, leaveMs());
}

// A move to another section starts here: the isotype fades in over this
// page, and the next page, told by sessionStorage, keeps it until it is
// ready.
function start() {
  if (!veil) return;
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return;
  }
  clear();
  veil.getBoundingClientRect();
  root.dataset.splash = 'section';
}

// On window, so every other handler has had its say: a click or a submit
// someone prevented (the tour, the editor, the downloads) is no move.
window.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  // A jump inside this same page.
  if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
  start();
});
window.addEventListener('submit', (e) => {
  const form = e.target;
  if (e.defaultPrevented || !(form instanceof HTMLFormElement) || form.method === 'dialog') return;
  if (form.target && form.target !== '_self') return;
  start();
});

// Back to a page the browser kept: it was already there, so no veil, and
// no move pending for the page after.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  clear();
});

if (document.readyState === 'complete') lift();
else window.addEventListener('load', lift, { once: true });
