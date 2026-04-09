const KEY = 'taager_my_picks'

export function getPickIds() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

export function isProductPicked(id) {
  return getPickIds().includes(id)
}

/** @returns {boolean} true إذا أصبح المنتج في المختارات */
export function toggleProductPick(id) {
  const ids = [...getPickIds()]
  const i = ids.indexOf(id)
  if (i >= 0) ids.splice(i, 1)
  else ids.push(id)
  localStorage.setItem(KEY, JSON.stringify(ids))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('taager-picks-update'))
  }
  return i < 0
}
