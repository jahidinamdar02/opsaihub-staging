/* ═══════════════════════════════════════════════════════════════
   OpsAIHub Skeleton Loading Components
   ═══════════════════════════════════════════════════════════════ */

const Skeleton = (function() {

  function card(options) {
    var opts = options || {};
    var rows = opts.rows || 3;
    var avatar = opts.avatar !== false;
    var image = opts.image || false;

    var html = '<div class="skeleton-card">';
    if (image) {
      html += '<div class="skeleton" style="height:180px;margin-bottom:12px;"></div>';
    }
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
    if (avatar) {
      html += '<div class="skeleton skeleton-circle" style="width:40px;height:40px;flex-shrink:0;"></div>';
    }
    html += '<div style="flex:1;">';
    html += '<div class="skeleton skeleton-text" style="width:60%;"></div>';
    html += '<div class="skeleton skeleton-text-sm" style="width:40%;"></div>';
    html += '</div></div>';
    for (var i = 0; i < rows; i++) {
      var width = 80 + Math.random() * 20;
      html += '<div class="skeleton skeleton-text" style="width:' + width + '%;"></div>';
    }
    html += '</div>';
    return html;
  }

  function list(count, options) {
    var opts = options || {};
    var html = '';
    for (var i = 0; i < (count || 5); i++) {
      html += '<div class="skeleton-row">';
      if (opts.avatar !== false) {
        html += '<div class="skeleton skeleton-circle" style="width:36px;height:36px;"></div>';
      }
      html += '<div style="flex:1;">';
      html += '<div class="skeleton skeleton-text" style="width:' + (50 + Math.random() * 30) + '%;"></div>';
      html += '<div class="skeleton skeleton-text-sm" style="width:' + (30 + Math.random() * 20) + '%;"></div>';
      html += '</div>';
      if (opts.badge) {
        html += '<div class="skeleton" style="width:60px;height:24px;border-radius:8px;"></div>';
      }
      html += '</div>';
    }
    return html;
  }

  function table(rows, cols) {
    var html = '<div class="skeleton-card" style="overflow:hidden;">';
    html += '<div style="display:flex;gap:16px;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);">';
    for (var c = 0; c < (cols || 4); c++) {
      html += '<div class="skeleton" style="height:12px;width:' + (60 + Math.random() * 40) + 'px;"></div>';
    }
    html += '</div>';
    for (var r = 0; r < (rows || 5); r++) {
      html += '<div style="display:flex;gap:16px;padding:14px 16px;border-bottom:1px solid var(--border);">';
      for (var c2 = 0; c2 < (cols || 4); c2++) {
        html += '<div class="skeleton" style="height:14px;width:' + (50 + Math.random() * 50) + 'px;"></div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function stats(count) {
    var html = '<div class="stat-grid">';
    for (var i = 0; i < (count || 3); i++) {
      html += '<div class="stat-card">';
      html += '<div class="skeleton" style="height:32px;width:60%;margin:0 auto 8px;"></div>';
      html += '<div class="skeleton" style="height:10px;width:80%;margin:0 auto;"></div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function page() {
    var html = '';
    html += '<div style="height:120px;background:linear-gradient(135deg,var(--red),var(--red-dark));margin-bottom:16px;"></div>';
    html += '<div style="padding:0 16px;">';
    html += stats(3);
    html += '<div style="margin-top:16px;">';
    html += card({ rows: 4, image: true });
    html += '</div></div>';
    return html;
  }

  function replace(element, skeletonHtml) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (element) {
      element.innerHTML = skeletonHtml;
      element.setAttribute('data-skeleton', 'true');
    }
  }

  function clear(element) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (element) {
      element.removeAttribute('data-skeleton');
    }
  }

  return {
    card: card,
    list: list,
    table: table,
    stats: stats,
    page: page,
    replace: replace,
    clear: clear
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Skeleton;
}
