// OpsAIHub API Utility
// Safe fetch with error handling and toast notifications

var API = {
  // Safe fetch wrapper with error handling
  fetch: function(url, options) {
    options = options || {};
    return fetch(url, options)
      .then(function(r) {
        if (!r.ok) {
          return r.json().catch(function() {
            return { success: false, error: 'Server error (' + r.status + ')' };
          }).then(function(data) {
            throw { status: r.status, message: data.error || 'Request failed', data: data };
          });
        }
        return r.json();
      })
      .catch(function(err) {
        if (err.status) {
          // Structured error from above
          API.toast(err.message, 'error');
          throw err;
        }
        // Network error
        API.toast('Network error — please check your connection', 'error');
        throw { status: 0, message: 'Network error', data: null };
      });
  },

  // Toast notification
  toast: function(msg, type) {
    type = type || 'success';
    var existing = document.querySelector('.api-toast');
    if (existing) existing.remove();

    var t = document.createElement('div');
    t.className = 'api-toast api-toast-' + type;
    t.textContent = (type === 'success' ? '\u2705 ' : type === 'error' ? '\u26A0\uFE0F ' : '\u2139\uFE0F ') + msg;
    t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);animation:apiToastIn 0.3s ease-out;' +
      (type === 'success' ? 'background:#1B7A3A;color:#fff;' : type === 'error' ? 'background:#FF3B30;color:#fff;' : 'background:#007AFF;color:#fff;');
    document.body.appendChild(t);
    setTimeout(function() {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s ease';
      setTimeout(function() { t.remove(); }, 300);
    }, type === 'error' ? 5000 : 3000);
  },

  // Show loading state on button
  loading: function(btn, show) {
    if (!btn) return;
    if (show) {
      btn.dataset.originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:8px;"></span>Saving...';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
  }
};

// Add CSS for toasts and animations
if (!document.getElementById('api-styles')) {
  var style = document.createElement('style');
  style.id = 'api-styles';
  style.textContent = '@keyframes apiToastIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
}
