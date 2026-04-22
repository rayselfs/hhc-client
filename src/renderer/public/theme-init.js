;(function () {
  var pref, settingsRaw, settings, tp, oldPref
  try {
    settingsRaw = localStorage.getItem('hhc-settings')
    if (settingsRaw) {
      settings = JSON.parse(settingsRaw)
      tp = settings && settings.state && settings.state.themePreference
      if (tp === 'dark' || tp === 'light' || tp === 'system') {
        pref = tp
      }
    }
  } catch {
    //
  }
  if (!pref) {
    try {
      oldPref = localStorage.getItem('hhc-theme')
      if (oldPref === 'dark' || oldPref === 'light' || oldPref === 'system') {
        pref = oldPref
      }
    } catch {
      //
    }
  }
  var isDark =
    pref === 'dark' ||
    (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
})()
