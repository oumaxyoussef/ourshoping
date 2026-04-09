import baseProducts from '../data/products.json'
import { COUNTRIES, COUNTRY_IDS } from './countries.js'
import { idbGet, idbSet } from './idbKv.js'
import { attachLegacyMediaFields } from './productMedia.js'

const EXTRA_PRODUCTS_KEY = 'taager_extra_products'
const ORDERS_KEY = 'taager_orders'
const FEATURED_PRODUCT_IDS_KEY = 'taager_featured_product_ids'
const PRODUCT_EDITS_KEY = 'taager_product_edits'
const HEADER_BANNERS_KEY = 'taager_header_banners'
const ADMIN_SESSION_KEY = 'taager_admin_ok'
const TRASH_KEY = 'taager_product_trash'
const DELETED_BASE_IDS_KEY = 'taager_deleted_base_product_ids'
const MAX_TRASH_ITEMS = 100

/** عدد صور البانر تحت الهيدر (سلايدر تلقائي) */
export const MAX_HEADER_BANNERS = 6

export const DEFAULT_HEADER_BANNERS = [
  'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1400&q=85&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1400&q=85&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1400&q=85&auto=format&fit=crop',
]

export function getHeaderBanners() {
  const list = readJson(HEADER_BANNERS_KEY, null)
  if (list == null) return [...DEFAULT_HEADER_BANNERS]
  if (!Array.isArray(list) || list.length === 0) return [...DEFAULT_HEADER_BANNERS]
  const filtered = list
    .filter((u) => typeof u === 'string' && u.trim())
    .slice(0, MAX_HEADER_BANNERS)
  return filtered.length > 0 ? filtered : [...DEFAULT_HEADER_BANNERS]
}

export function setHeaderBanners(urls) {
  const clean = (urls || [])
    .filter((u) => typeof u === 'string' && u.trim())
    .slice(0, MAX_HEADER_BANNERS)
  localStorage.setItem(HEADER_BANNERS_KEY, JSON.stringify(clean))
  notifyStoreUpdate()
}

export function resetHeaderBannersToDefault() {
  localStorage.removeItem(HEADER_BANNERS_KEY)
  notifyStoreUpdate()
}

const CATEGORIES_KEY = 'taager_categories'

/** حد أقصى لتصنيفات المتجر (صورة + اسم لكل تصنيف) */
export const MAX_CATEGORIES = 16

export const DEFAULT_CATEGORIES = [
  {
    id: 'cat-default-1',
    nameAr: 'إلكترونيات',
    imageUrl:
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=240&q=80&fit=crop',
  },
  {
    id: 'cat-default-2',
    nameAr: 'ملابس',
    imageUrl:
      'https://images.unsplash.com/photo-1445205170230-053b83016050?w=240&q=80&fit=crop',
  },
  {
    id: 'cat-default-3',
    nameAr: 'منتجات ترفيهية',
    imageUrl:
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=240&q=80&fit=crop',
  },
  {
    id: 'cat-default-4',
    nameAr: 'الصحة والجمال',
    imageUrl:
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=240&q=80&fit=crop',
  },
  {
    id: 'cat-default-5',
    nameAr: 'المنزل',
    imageUrl:
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=240&q=80&fit=crop',
  },
  {
    id: 'cat-default-6',
    nameAr: 'تاجر جملة',
    imageUrl:
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=240&q=80&fit=crop',
  },
]

function ensureDefaultCategories(list) {
  const out = [...list]
  const existingIds = new Set(out.map((c) => String(c.id)))
  for (const d of DEFAULT_CATEGORIES) {
    if (out.length >= MAX_CATEGORIES) break
    if (existingIds.has(d.id)) continue
    out.push({ ...d })
    existingIds.add(d.id)
  }
  return out
}

export function getCategories() {
  const list = readJson(CATEGORIES_KEY, null)
  if (list == null) return DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  if (!Array.isArray(list)) return DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  const cleaned = list
    .filter(
      (c) =>
        c &&
        typeof c.id === 'string' &&
        c.id.trim() &&
        typeof c.nameAr === 'string' &&
        c.nameAr.trim(),
    )
    .map((c) => ({
      id: String(c.id).trim(),
      nameAr: String(c.nameAr).trim(),
      imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl.trim() : '',
    }))
    .slice(0, MAX_CATEGORIES)
  if (cleaned.length === 0) return DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  return ensureDefaultCategories(cleaned)
}

export function setCategories(categories) {
  const clean = (categories || [])
    .filter((c) => c && c.id && c.nameAr)
    .slice(0, MAX_CATEGORIES)
    .map((c) => ({
      id: String(c.id),
      nameAr: String(c.nameAr).trim(),
      imageUrl: String(c.imageUrl || '').trim(),
    }))
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(clean))
  notifyStoreUpdate()
}

export function addCategory({ nameAr, imageUrl }) {
  const name = String(nameAr || '').trim()
  if (!name) return false
  const list = getCategories()
  const id = `cat-${Date.now()}`
  list.push({
    id,
    nameAr: name,
    imageUrl: String(imageUrl || '').trim(),
  })
  setCategories(list)
  return true
}

export function removeCategory(categoryId) {
  const id = String(categoryId)
  setCategories(getCategories().filter((c) => c.id !== id))
}

/** Mot de passe admin : définir VITE_ADMIN_PASSWORD dans .env (sinon défaut dev uniquement). */
export function getAdminPassword() {
  return import.meta.env.VITE_ADMIN_PASSWORD ?? 'admin123'
}

export function adminLogin(password) {
  if (password === getAdminPassword()) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
    return true
  }
  return false
}

export function adminLogout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
}

export function isAdminLoggedIn() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

const DEFAULT_RATING = 4.6
const DEFAULT_REVIEW_COUNT = 48
const DEFAULT_SOLD_COUNT = 320

/** بعد hydrateStoreCaches() تُقرأ من الذاكرة؛ قبلها من localStorage */
let extraProductsCache = null
let productEditsCache = null
let trashCache = null

function readExtraRaw() {
  if (extraProductsCache !== null) return extraProductsCache
  const list = readJson(EXTRA_PRODUCTS_KEY, [])
  extraProductsCache = Array.isArray(list) ? list : []
  return extraProductsCache
}

async function persistExtraRaw(arr) {
  extraProductsCache = arr
  await idbSet(EXTRA_PRODUCTS_KEY, arr)
  try {
    localStorage.removeItem(EXTRA_PRODUCTS_KEY)
  } catch {
    /* ignore */
  }
}

async function persistEdits() {
  await idbSet(PRODUCT_EDITS_KEY, getEditsMap())
  try {
    localStorage.removeItem(PRODUCT_EDITS_KEY)
  } catch {
    /* ignore */
  }
}

async function persistTrash(entries) {
  const clean = entries.slice(0, MAX_TRASH_ITEMS)
  trashCache = clean
  await idbSet(TRASH_KEY, clean)
  try {
    localStorage.removeItem(TRASH_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * يحمّل البيانات الثقيلة (منتجات مخصصة، تعديلات، سلة محذوفات) إلى IndexedDB
 * ويحرّر مساحة localStorage. يُستدعى مرة عند إقلاع التطبيق قبل الرسم.
 */
export async function hydrateStoreCaches() {
  const fallbackFromLs = () => {
    if (extraProductsCache === null) {
      const ex = readJson(EXTRA_PRODUCTS_KEY, [])
      extraProductsCache = Array.isArray(ex) ? ex : []
    }
    if (productEditsCache === null) {
      const ed = readJson(PRODUCT_EDITS_KEY, {})
      productEditsCache =
        ed && typeof ed === 'object' && !Array.isArray(ed) ? ed : {}
    }
    if (trashCache === null) {
      const tr = readJson(TRASH_KEY, [])
      trashCache = Array.isArray(tr) ? tr : []
    }
  }

  try {
    let extra = await idbGet(EXTRA_PRODUCTS_KEY)
    if (extra === undefined) {
      extra = readJson(EXTRA_PRODUCTS_KEY, [])
      if (!Array.isArray(extra)) extra = []
      await idbSet(EXTRA_PRODUCTS_KEY, extra)
    }
    extraProductsCache = Array.isArray(extra) ? extra : []

    let edits = await idbGet(PRODUCT_EDITS_KEY)
    if (edits === undefined) {
      edits = readJson(PRODUCT_EDITS_KEY, {})
      if (!edits || typeof edits !== 'object' || Array.isArray(edits)) edits = {}
      await idbSet(PRODUCT_EDITS_KEY, edits)
    }
    productEditsCache =
      edits && typeof edits === 'object' && !Array.isArray(edits) ? edits : {}

    let trash = await idbGet(TRASH_KEY)
    if (trash === undefined) {
      trash = readJson(TRASH_KEY, [])
      if (!Array.isArray(trash)) trash = []
      await idbSet(TRASH_KEY, trash)
    }
    trashCache = Array.isArray(trash) ? trash : []

    try {
      localStorage.removeItem(EXTRA_PRODUCTS_KEY)
      localStorage.removeItem(PRODUCT_EDITS_KEY)
      localStorage.removeItem(TRASH_KEY)
    } catch {
      /* ignore */
    }
  } catch {
    fallbackFromLs()
  }
}

/**
 * أسواق العرض: EG SA AE IQ OM — القيم غير المعروفة تُستبعد.
 * الافتراضي للمنتجات القديمة: السعودية + الإمارات.
 */
export function normalizeProductMarkets(p) {
  const m = p?.markets
  if (Array.isArray(m) && m.length > 0) {
    const ok = [...new Set(m.filter((x) => COUNTRY_IDS.includes(x)))]
    if (ok.length > 0) return ok
  }
  return ['SA', 'AE']
}

/** هل المنتج متاح للتوصيل/العرض في بلد الزبون؟ */
export function productAvailableInCountry(p, countryId) {
  if (!countryId || !COUNTRY_IDS.includes(countryId)) return false
  return normalizeProductMarkets(p).includes(countryId)
}

/** @deprecated استخدم productAvailableInCountry مع بلد الزبون */
export function productVisibleForCurrency(p, currency) {
  const m = normalizeProductMarkets(p)
  if (currency === 'AED') return m.includes('AE')
  return m.includes('SA')
}

export function formatMarketsLabel(p) {
  const m = normalizeProductMarkets(p)
  const labels = m
    .map((id) => COUNTRIES.find((c) => c.id === id)?.nameAr)
    .filter(Boolean)
  return labels.length ? labels.join('، ') : '—'
}

/** يضمن ظهور سطر الآراء في المتجر (منتجات قديمة بلا حقول + جديدة). */
function withDefaultReviews(p) {
  const out = { ...p }
  const reviewsOk =
    typeof out.rating === 'number' &&
    !Number.isNaN(out.rating) &&
    out.rating >= 0 &&
    out.rating <= 5 &&
    typeof out.reviewCount === 'number' &&
    Number.isFinite(out.reviewCount) &&
    out.reviewCount >= 0
  if (!reviewsOk) {
    out.rating = DEFAULT_RATING
    out.reviewCount = DEFAULT_REVIEW_COUNT
  }
  if (
    typeof out.soldCount !== 'number' ||
    !Number.isFinite(out.soldCount) ||
    out.soldCount <= 0
  ) {
    out.soldCount = DEFAULT_SOLD_COUNT
  }
  out.markets = normalizeProductMarkets(out)
  return attachLegacyMediaFields(out)
}

function getEditsMap() {
  if (productEditsCache !== null) return productEditsCache
  const o = readJson(PRODUCT_EDITS_KEY, {})
  productEditsCache =
    o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  return productEditsCache
}

function mergeWithStoredEdit(p) {
  const e = getEditsMap()[p.id]
  return withDefaultReviews(e ? { ...p, ...e } : { ...p })
}

export function getExtraProducts() {
  return readExtraRaw().map((p) => mergeWithStoredEdit(withDefaultReviews({ ...p })))
}

/** كل المنتجات (أساسية + إضافية) قبل إخفاء المحذوفة من الأصل */
function buildFullProductCatalog() {
  return [
    ...baseProducts.map(mergeWithStoredEdit),
    ...readExtraRaw().map((p) => mergeWithStoredEdit(withDefaultReviews({ ...p }))),
  ]
}

function readDeletedBaseIds() {
  const raw = readJson(DELETED_BASE_IDS_KEY, [])
  return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [])
}

export function getMergedProducts() {
  const hiddenBase = readDeletedBaseIds()
  return [
    ...baseProducts.map(mergeWithStoredEdit).filter((p) => !hiddenBase.has(p.id)),
    ...readExtraRaw().map((p) => mergeWithStoredEdit(withDefaultReviews({ ...p }))),
  ]
}

/** سلة المحذوفات: { id, deletedAt, product }[] */
export function getTrash() {
  if (trashCache !== null) return Array.isArray(trashCache) ? trashCache : []
  const t = readJson(TRASH_KEY, [])
  trashCache = Array.isArray(t) ? t : []
  return trashCache
}

/**
 * حذف ناعم: يختفي من المتجر ويُنقل للسلة. أساسي = يبقى في JSON لكن مخفي؛ مخصص = يُزال من الإضافي.
 */
export async function softDeleteProduct(productId) {
  const id = String(productId)
  const catalog = buildFullProductCatalog()
  const product = catalog.find((p) => p.id === id)
  if (!product) return false

  const trash = getTrash().filter((t) => t.id !== id)
  trash.unshift({
    id,
    deletedAt: Date.now(),
    product: JSON.parse(JSON.stringify(product)),
  })
  await persistTrash(trash)

  const feat = getFeaturedProductIds().filter((x) => x !== id)
  setFeaturedProductIds(feat)

  if (id.startsWith('custom-')) {
    const extra = readExtraRaw().filter((p) => p.id !== id)
    await persistExtraRaw(extra)
    const edits = getEditsMap()
    if (edits[id]) {
      delete edits[id]
      await persistEdits()
    }
  } else {
    const cur = [...readDeletedBaseIds()]
    if (!cur.includes(id)) cur.push(id)
    localStorage.setItem(DELETED_BASE_IDS_KEY, JSON.stringify(cur))
  }

  notifyStoreUpdate()
  return true
}

/** استعادة من السلة إلى المتجر */
export async function restoreProductFromTrash(productId) {
  const id = String(productId)
  const trash = getTrash()
  const entry = trash.find((t) => t.id === id)
  if (!entry) return false

  const rest = trash.filter((t) => t.id !== id)
  await persistTrash(rest)

  if (id.startsWith('custom-')) {
    const extra = readExtraRaw()
    if (!extra.some((p) => p.id === id)) {
      extra.push(entry.product)
      await persistExtraRaw(extra)
    }
  } else {
    const cur = [...readDeletedBaseIds()].filter((x) => x !== id)
    localStorage.setItem(DELETED_BASE_IDS_KEY, JSON.stringify(cur))
  }

  notifyStoreUpdate()
  return true
}

/** حذف نهائي من السلة فقط (الأساسي يبقى مخفياً إن كان محذوفاً من الأصل) */
export async function purgeTrashEntry(productId) {
  const id = String(productId)
  const rest = getTrash().filter((t) => t.id !== id)
  await persistTrash(rest)
  notifyStoreUpdate()
  return true
}

/** إزالة التعديلات المحفوظة للمنتجات الأساسية (العودة لقيم JSON) */
export async function removeProductEdit(productId) {
  const id = String(productId)
  const edits = getEditsMap()
  if (!edits[id]) return
  delete edits[id]
  await persistEdits()
  notifyStoreUpdate()
}

/**
 * حفظ تعديل منتج: المنتجات custom تُحدَّث في التخزين؛ الباقي في طبقة التعديلات.
 */
export async function saveProduct(productId, payload) {
  try {
    const id = String(productId)
    if (id.startsWith('custom-')) {
      const raw = readExtraRaw()
      const idx = raw.findIndex((p) => p.id === id)
      if (idx < 0) return false
      raw[idx] = { ...raw[idx], ...payload }
      await persistExtraRaw(raw)
      const edits = getEditsMap()
      if (edits[id]) {
        delete edits[id]
        await persistEdits()
      }
    } else {
      const edits = getEditsMap()
      edits[id] = { ...(edits[id] || {}), ...payload }
      await persistEdits()
    }
    notifyStoreUpdate()
    return true
  } catch {
    return false
  }
}

/** معرفات المنتجات المعروضة في بلوك «الأكثر مبيعاً اليوم». فارغ = كل المنتجات. */
export function getFeaturedProductIds() {
  const list = readJson(FEATURED_PRODUCT_IDS_KEY, [])
  if (!Array.isArray(list)) return []
  return [...new Set(list.filter((id) => typeof id === 'string' && id.trim()))]
}

export function setFeaturedProductIds(ids) {
  const clean = []
  const seen = new Set()
  for (const id of ids) {
    if (typeof id !== 'string' || !id.trim() || seen.has(id)) continue
    seen.add(id)
    clean.push(id)
  }
  localStorage.setItem(FEATURED_PRODUCT_IDS_KEY, JSON.stringify(clean))
  notifyStoreUpdate()
}

export function toggleFeaturedProductId(productId) {
  const id = String(productId)
  const cur = getFeaturedProductIds()
  const set = new Set(cur)
  if (set.has(id)) {
    setFeaturedProductIds(cur.filter((x) => x !== id))
  } else {
    setFeaturedProductIds([...cur, id])
  }
}

export async function addExtraProduct(product) {
  try {
    const extra = readExtraRaw()
    const id = `custom-${Date.now()}`
    extra.push(withDefaultReviews({ ...product, id }))
    await persistExtraRaw(extra)
    notifyStoreUpdate()
    return true
  } catch {
    return false
  }
}

export async function removeExtraProduct(id) {
  if (!String(id).startsWith('custom-')) return
  const extra = readExtraRaw().filter((p) => p.id !== id)
  await persistExtraRaw(extra)
  notifyStoreUpdate()
}

export function getOrders() {
  const list = readJson(ORDERS_KEY, [])
  return Array.isArray(list) ? list : []
}

/** حالة الطلب في لوحة الإدارة: pending = جديد، validated = مؤكد */
export function updateOrder(id, patch) {
  const orders = getOrders()
  const idx = orders.findIndex((o) => o.id === id)
  if (idx < 0) return false
  orders[idx] = { ...orders[idx], ...patch }
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  notifyStoreUpdate()
  return true
}

export function removeOrder(id) {
  const orders = getOrders().filter((o) => o.id !== id)
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  notifyStoreUpdate()
}

export function addOrder(order) {
  const orders = getOrders()
  const row = {
    ...order,
    id: `ord-${Date.now()}`,
    createdAt: Date.now(),
    status: 'pending',
  }
  orders.unshift(row)
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  notifyStoreUpdate()
}

export function notifyStoreUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('taager-store-update'))
  }
}
