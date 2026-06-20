// ── Theme (shared across all pages) ──
// Supports: manual toggle, localStorage persistence, system preference detection

(function() {
  var stored = localStorage.getItem('th_theme');
  var theme;

  if (stored) {
    theme = stored;
  } else {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  document.documentElement.setAttribute('data-theme', theme);
  updateIcons(theme);
})();

function getTheme() {
  var stored = localStorage.getItem('th_theme');
  if (stored) return stored;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function isSystemTheme() {
  return !localStorage.getItem('th_theme');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateIcons(theme);
}

function updateIcons(theme) {
  var btn = document.getElementById('themeToggle');
  var sun = document.getElementById('themeIconSun');
  var moon = document.getElementById('themeIconMoon');
  if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  if (sun && moon) {
    sun.style.display = theme === 'dark' ? 'none' : 'block';
    moon.style.display = theme === 'dark' ? 'block' : 'none';
  }
  // Update system indicator
  updateSystemIndicator();
}

function updateSystemIndicator() {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;
  var indicator = btn.querySelector('.theme-system-dot');
  if (isSystemTheme()) {
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'theme-system-dot';
      indicator.title = 'Following system preference';
      btn.appendChild(indicator);
    }
  } else {
    if (indicator) indicator.remove();
  }
}

function toggleTheme() {
  var next = getTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem('th_theme', next);
  var btn = document.getElementById('themeToggle');
  if (btn) {
    document.body.classList.add('theme-transitioning');
    btn.classList.remove('spin');
    void btn.offsetWidth;
    btn.classList.add('spin');
  }
  applyTheme(next);
  setTimeout(function() {
    document.body.classList.remove('theme-transitioning');
    if (btn) btn.classList.remove('spin');
  }, 400);
}

function resetToSystemTheme() {
  localStorage.removeItem('th_theme');
  var theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
  applyTheme(theme);
}

// Listen for system theme changes (auto-update unless user manually toggled)
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    if (!localStorage.getItem('th_theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}
