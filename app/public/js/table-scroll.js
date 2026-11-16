// Administration tables (SPEC §9): marks a table's frame while it has
// columns left to scroll to on the right, or scrolled past on the left, so
// app.css shades that edge.
// Without this script the table still scrolls; it only lacks the shade.
for (const scroller of document.querySelectorAll('[data-table-scroll]')) {
  const frame = scroller.parentElement;
  const update = () => {
    frame.classList.toggle('has-more', scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
    frame.classList.toggle('has-before', scroller.scrollLeft > 1);
  };
  scroller.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(scroller);
  update();
}
