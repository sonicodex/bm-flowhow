// The splash between sections (SPEC §9, Visual style): where a move from
// one page of the app to another starts. Loaded by every page.
//
// The veil itself, and both holds (the logotype's and the isotype's), live
// in the inline script in the <head> (src/layout.tsx), which cannot fail to
// arrive. This file only notices the click or the submit that starts a move:
// the isotype fades in over this page, and the next page, told by
// sessionStorage when the move started, keeps it until --splash-section-hold
// has passed since the click and it has loaded, whichever comes last.

const root = document.documentElement;
const veil = document.querySelector('.splash');
// The moment a move between sections started, for the next page's head.
const KEY = 'flowhow-splash';

function forget() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

function clear() {
  delete root.dataset.splash;
  delete root.dataset.splashCarry;
  delete root.dataset.splashLeaving;
  delete root.dataset.splashMove;
  root.style.removeProperty('--splash-elapsed');
}

// A page that asks before letting the reader go (the editor with unsaved
// changes, the importer's passwords): the browser's own question comes up
// over the page, so the veil goes at once. If the reader leaves after all,
// the next page still continues the move; if they stay, the pending move is
// forgotten the next time they touch or type on this page, which only a
// page still there can see. Registered at the click, so it runs after the
// page's own handlers.
function onLeave(e) {
  if (!e.defaultPrevented) return;
  clear();
  window.addEventListener('pointerdown', forget, { once: true, capture: true });
  window.addEventListener('keydown', forget, { once: true, capture: true });
}

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
  // Tells this page's head script that its own veil is over.
  root.dataset.splashMove = '';
  window.addEventListener('beforeunload', onLeave, { once: true });
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
  forget();
  clear();
});
