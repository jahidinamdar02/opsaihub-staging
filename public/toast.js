/* ═══════════════════════════════════════════════════════════════
   OpsAIHub Toast Notification System
   ═══════════════════════════════════════════════════════════════ */

const Toast = (function() {
  let container = null;

  function init() {
    if (container) return;
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  function show(options) {
    init();
    const opts = typeof options === 'string' ? { message: options } : options;
    const type = opts.type || 'info';
    const title = opts.title || '';
    const message = opts.message || '';
    const duration = opts.duration !== undefined ? opts.duration : 4000;

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = ''
      + '<span class="toast-icon">' + (opts.icon || icons[type] || icons.info) + '</span>'
      + '<div class="toast-content">'
      +   (title ? '<div class="toast-title">' + escapeHtml(title) + '</div>' : '')
      +   (message ? '<div class="toast-message">' + escapeHtml(message) + '</div>' : '')
      + '</div>'
      + '<button class="toast-close" aria-label="Close">&times;</button>';

    toast.querySelector('.toast-close').addEventListener('click', function() {
      remove(toast);
    });

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(function() { remove(toast); }, duration);
    }

    return toast;
  }

  function remove(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('removing');
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  function success(message, title) {
    return show({ type: 'success', title: title || 'Success', message: message });
  }

  function error(message, title) {
    return show({ type: 'error', title: title || 'Error', message: message, duration: 6000 });
  }

  function warning(message, title) {
    return show({ type: 'warning', title: title || 'Warning', message: message });
  }

  function info(message, title) {
    return show({ type: 'info', title: title || 'Info', message: message });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { show: show, success: success, error: error, warning: warning, info: info };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Toast;
}
