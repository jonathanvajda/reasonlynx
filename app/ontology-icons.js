function attrs(extra = '') {
  return `width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${extra}`;
}

export function iconSvg(name) {
  switch (String(name || '').toLowerCase()) {
    case 'github':
      return `<svg class="ont-catalog__icon ont-catalog__icon--github" ${attrs('fill="currentColor"')}><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.2.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 .1.7 2.4 3.4 1.7.1-.8.4-1.3.7-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17.3 5.5 18.3 5.8 18.3 5.8c.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3c0 .4.2.7.8.6A12 12 0 0 0 12 .5Z"/></svg>`;
    case 'gitlab':
      return `<svg class="ont-catalog__icon" ${attrs('fill="none"')}><path fill="#E24329" d="m12 22 3.7-11.4H8.3L12 22Z"/><path fill="#FC6D26" d="M12 22 8.3 10.6H3.1L12 22Zm0 0 3.7-11.4h5.2L12 22Z"/><path fill="#FCA326" d="M3.1 10.6 2 14c-.1.4 0 .8.4 1.1L12 22 3.1 10.6Zm17.8 0L22 14c.1.4 0 .8-.4 1.1L12 22l8.9-11.4Z"/><path fill="#E24329" d="M3.1 10.6h5.2L6.1 3.8c-.1-.5-.8-.5-1 0l-2 6.8Zm17.8 0h-5.2l2.2-6.8c.1-.5.8-.5 1 0l2 6.8Z"/></svg>`;
    case 'download':
      return `<svg class="ont-catalog__icon" ${attrs('fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>`;
    case 'copy':
      return `<svg class="ont-catalog__icon" ${attrs('fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    case 'git':
    default:
      return `<svg class="ont-catalog__icon" ${attrs('fill="none"')}><path fill="#F05033" d="M22.4 10.9 13.1 1.6a1.9 1.9 0 0 0-2.7 0L8.5 3.5l2.4 2.4a2.3 2.3 0 0 1 2.9 2.9l2.3 2.3a2.3 2.3 0 1 1-1.4 1.3l-2.2-2.2v5.7a2.3 2.3 0 1 1-1.9 0V10a2.3 2.3 0 0 1-1.2-3L7.1 4.8l-5.5 5.6a1.9 1.9 0 0 0 0 2.7l9.3 9.3a1.9 1.9 0 0 0 2.7 0l8.8-8.8a1.9 1.9 0 0 0 0-2.7Z"/></svg>`;
  }
}
