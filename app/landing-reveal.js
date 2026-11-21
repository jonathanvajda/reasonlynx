(() => {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('reveal-pending');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px 80px 0px' });

  document.querySelectorAll('[data-reveal]').forEach((card) => {
    if (card.getBoundingClientRect().top > window.innerHeight) {
      card.classList.add('reveal-pending');
      observer.observe(card);
    }
  });
})();
