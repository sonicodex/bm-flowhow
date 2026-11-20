// The splash between sections (SPEC §9, Visual style): the isotype while
// moving from one page of the app to another. Loaded by every page.
//
// It is a cap, not a wait. The longest it may stay is enforced by app.css
// alone, from the first paint (--splash-section-max), so it holds even when
// this file is slow to come; this file only lifts it earlier, as soon as
// the page has loaded. The inline script in the <head> (src/layout.tsx)
// decides, before the first paint, whether this page continues a move
// between sections or was loaded from the server, and holds the logotype
// in that case itself: that one is a wait, and this file leaves it alone.

const root = document.documentElement;
const veil = document.querySelector('.splash');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// The moment a move between sections started, for the next page's head.
const KEY = 'flowhow-splash';

const leaveMs = () => parseFloat(getComputedStyle(root).getPropertyValue('--splash-leave')) || 0;

function clear() {
  delete root.dataset.splash;
  delete root.dataset.splashCarry;
  delete root.dataset.splashLeaving;
  root.style.removeProperty('--splash-elapsed');
  veil?.removeAttribute('style');
}

// From wherever the veil is (fading in, waiting), fade it out. With reduced
// motion it simply goes.
function lift() {
  if (!veil || root.dataset.splash !== 'section') return;
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
