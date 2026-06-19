// ── Theme (shared across all pages) ──
(function() {
  var theme = localStorage.getItem('th_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();

function getTheme() {
  return localStorage.getItem('th_theme') || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var btn = document.getElementById('themeToggle');
  var sun = document.getElementById('themeIconSun');
  var moon = document.getElementById('themeIconMoon');
  if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  if (sun && moon) {
    sun.style.display = theme === 'dark' ? 'none' : 'block';
    moon.style.display = theme === 'dark' ? 'block' : 'none';
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
