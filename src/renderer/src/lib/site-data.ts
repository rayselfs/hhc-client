const KNOWN_INDEXED_DBS = ['hhc-bible']

function clearLocalStorage(): void {
  try {
    localStorage.clear()
  } catch (e) {
    console.warn('[site-data] Failed to clear localStorage:', e)
  }
}

function clearSessionStorage(): void {
  try {
    sessionStorage.clear()
  } catch (e) {
    console.warn('[site-data] Failed to clear sessionStorage:', e)
  }
}

function clearIndexedDB(): void {
  if (typeof indexedDB === 'undefined') return

  if (indexedDB.databases) {
    indexedDB
      .databases()
      .then((dbs) => {
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name)
        }
      })
      .catch((e) => {
        console.warn('[site-data] indexedDB.databases() failed, using fallback:', e)
        for (const name of KNOWN_INDEXED_DBS) {
          indexedDB.deleteDatabase(name)
        }
      })
  } else {
    for (const name of KNOWN_INDEXED_DBS) {
      indexedDB.deleteDatabase(name)
    }
  }
}

function clearCacheAPI(): void {
  if (typeof caches === 'undefined') return
  caches
    .keys()
    .then((names) => {
      for (const name of names) {
        caches.delete(name)
      }
    })
    .catch((e) => {
      console.warn('[site-data] Failed to clear Cache API:', e)
    })
}

function clearCookies(): void {
  try {
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim()
      if (name) {
        document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`
      }
    })
  } catch (e) {
    console.warn('[site-data] Failed to clear cookies:', e)
  }
}

export function clearAllSiteData(): void {
  clearLocalStorage()
  clearSessionStorage()
  clearIndexedDB()
  clearCacheAPI()
  clearCookies()
}
