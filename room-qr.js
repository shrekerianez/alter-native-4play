(() => {
  const CDN = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
  let loading = null;

  function inviteUrl() {
    const url = new URL(location.href);
    const code = url.searchParams.get('room');
    if (!code) return '';
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', code);
    return url.toString();
  }

  function loadQrLibrary() {
    if (window.QRCode) return Promise.resolve(window.QRCode);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CDN;
      script.async = true;
      script.onload = () => window.QRCode ? resolve(window.QRCode) : reject(new Error('QRCode unavailable'));
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return loading;
  }

  async function renderQr() {
    const shareRow = document.querySelector('.room-share-row');
    const codeBlock = document.querySelector('.room-code-block');
    if (!shareRow || !codeBlock || document.querySelector('.room-qr-card')) return;
    const url = inviteUrl();
    if (!url) return;

    const wrap = document.createElement('div');
    wrap.className = 'room-qr-card';
    wrap.innerHTML = '<div class="room-qr-box" aria-label="QR-код комнаты"></div><div class="room-qr-copy"><strong>Сканируй камерой iPhone</strong><small>Откроется вход именно в эту комнату.</small></div>';
    shareRow.insertAdjacentElement('afterend', wrap);

    try {
      const QRCode = await loadQrLibrary();
      const box = wrap.querySelector('.room-qr-box');
      new QRCode(box, {
        text: url,
        width: 176,
        height: 176,
        colorDark: '#0a0a0d',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch {
      wrap.remove();
    }
  }

  const observer = new MutationObserver(() => renderQr());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('load', renderQr);
})();
