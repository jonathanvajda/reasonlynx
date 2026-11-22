(() => {
  const mascot = document.querySelector('.hero-mascot img');
  const origin = document.querySelector('.hero-mascot');
  const brand = document.querySelector('.brand img');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!mascot || !origin || !brand) return;

  let scheduled = false;
  function update() {
    scheduled = false;
    if (reduceMotion.matches) {
      mascot.style.transform = '';
      mascot.style.opacity = '';
      brand.style.opacity = '';
      return;
    }
    const progress = Math.min(1, Math.max(0, window.scrollY / 260));
    const start = origin.getBoundingClientRect();
    const target = brand.getBoundingClientRect();
    const width = mascot.offsetWidth;
    const height = mascot.offsetHeight;
    const x = target.left + target.width / 2 - (start.left + start.width / 2);
    const y = target.top + target.height / 2 - (start.top + start.height / 2);
    const scale = target.height / height;
    mascot.style.transform = `translate(${x * progress}px, ${y * progress}px) scale(${1 + (scale - 1) * progress})`;
    mascot.style.opacity = String(1 - Math.max(0, (progress - .8) / .2));
    brand.style.opacity = String(.35 + .65 * progress);
  }
  function requestUpdate() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  mascot.addEventListener('load', requestUpdate);
  reduceMotion.addEventListener('change', requestUpdate);
  requestUpdate();
})();
