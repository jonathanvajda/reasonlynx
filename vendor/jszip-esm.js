if (!globalThis.JSZip) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/jszip.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load JSZip vendor bundle.'));
    document.head.appendChild(script);
  });
}

export default globalThis.JSZip;
