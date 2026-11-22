(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const name = form.elements.namedItem('name');
  const email = form.elements.namedItem('email');
  const phone = form.elements.namedItem('phone');
  const topic = form.elements.namedItem('topic');
  const message = form.elements.namedItem('message');
  const examples = {
    'Consulting': 'For example: We are exploring a knowledge graph and would like to discuss scope and a quote.',
    'Training': 'For example: I would like to discuss ontology development training for my team.',
    'Consulting and training': 'For example: We would like help with a project and training for our team.',
    'Something else': 'For example: I have a question about using the ReasonLynx tools.'
  };
  topic.addEventListener('change', () => {
    message.placeholder = examples[topic.value] || 'For example: I would like to discuss ontology development training for my team.';
  });
  name.addEventListener('input', () => name.setCustomValidity(''));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!name.value.trim()) {
      name.setCustomValidity('Please enter your name.');
      name.reportValidity();
      return;
    }
    const subject = topic.value ? `ReasonLynx inquiry: ${topic.value}` : 'ReasonLynx inquiry';
    const lines = ['Hello ReasonLynx,', ''];
    if (message.value.trim()) lines.push(message.value.trim(), '');
    if (topic.value) lines.push(`Interested in: ${topic.value}`);
    lines.push(`Name: ${name.value.trim()}`, `Email: ${email.value.trim()}`);
    if (phone.value.trim()) lines.push(`Phone: ${phone.value.trim()}`);
    const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\r\n'))}`;
    window.location.href = `mailto:jonathan@reasonlynx.com?${query}`;
  });
  form.hidden = false;
})();
