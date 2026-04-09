/**
 * تخزين مفتاح/قيمة في IndexedDB — حصة أكبر بكثير من localStorage (مناسب للصور base64).
 */
const DB_NAME = 'taager_app'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise = null

function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB غير متوفر'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onerror = () => reject(req.error ?? new Error('فتح قاعدة البيانات فشل'))
      req.onsuccess = () => resolve(req.result)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE)
        }
      }
    })
  }
  return dbPromise
}

export async function idbGet(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const st = tx.objectStore(STORE)
    const r = st.get(key)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export async function idbSet(key, value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const st = tx.objectStore(STORE)
    const r = st.put(value, key)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}
