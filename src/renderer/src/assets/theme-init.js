;(function () {
  // Key must match createStorageKey('theme') from lib/storage-keys.ts
  var pref = localStorage.getItem('hhc-theme')
  var isDark =
    pref === 'dark' ||
    (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
})()
