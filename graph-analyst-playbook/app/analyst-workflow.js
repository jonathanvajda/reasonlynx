function showTab(id, selectedTab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  selectedTab.classList.add('active');
}

function selectStep(el) {
  document.getElementById('inspector').classList.remove('hidden');
}

function addStep() {
  alert('Add step UI goes here');
}

document.querySelectorAll('.tab[data-tab]').forEach((tab) => {
  tab.addEventListener('click', () => showTab(tab.dataset.tab, tab));
});

document.querySelectorAll('[data-select-step]').forEach((step) => {
  step.addEventListener('click', () => selectStep(step));
});

document.getElementById('addStepBtn')?.addEventListener('click', addStep);
