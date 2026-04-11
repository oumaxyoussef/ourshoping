import baseProducts from '../data/products.json'
import { COUNTRIES, COUNTRY_IDS } from './countries.js'
import { supabase } from './supabase.js'
import { attachLegacyMediaFields } from './productMedia.js'

const ADMIN_SESSION_KEY = 'taager_admin_ok'
const MAX_TRASH_ITEMS = 100

// ─── Banner defaults ──────────────────────────────────────────────────────────

export const MAX_HEADER_BANNERS = 6

export const DEFAULT_HEADER_BANNERS = [
  'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1400&q=85&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1400&q=85&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1400&q=85&auto=format&fit=crop',
]

// ─── Supabase config helpers ──────────────────────────────────────────────────

async function sbGetConfig(key, fallback) {
  try {
    if (!supabase) return fallback
    const { data } = await supabase.from('store_config').select('value').eq('key', key).single()
    return data ? data.value : fallback
  } catch {
    return fallback
  }
}

async function sbSetConfig(key, value) {
  if (!supabase) return
  await supabase.from('store_config').upsert({ key, value })
}

// ─── Header Banners ───────────────────────────────────────────────────────────

export async function getHeaderBanners() {
  const list = await sbGetConfig('header_banners', null)
  if (!Array.isArray(list) || list.length === 0) return [...DEFAULT_HEADER_BANNERS]
  const filtered = list.filter((u) => typeof u === 'string' && u.trim()).slice(0, MAX_HEADER_BANNERS)
  return filtered.length > 0 ? filtered : [...DEFAULT_HEADER_BANNERS]
}

export async function setHeaderBanners(urls) {
  const clean = (urls || []).filter((u) => typeof u === 'string' && u.trim()).slice(0, MAX_HEADER_BANNERS)
  await sbSetConfig('header_banners', clean)
  notifyStoreUpdate()
}

export async function resetHeaderBannersToDefault() {
  await sbSetConfig('header_banners', DEFAULT_HEADER_BANNERS)
  notifyStoreUpdate()
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const MAX_CATEGORIES = 16

export const DEFAULT_CATEGORIES = [
  { id: 'cat-default-1', nameAr: 'إلكترونيات', imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=240&q=80&fit=crop' },
  { id: 'cat-default-2', nameAr: 'ملابس', imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=240&q=80&fit=crop' },
  { id: 'cat-default-3', nameAr: 'منتجات ترفيهية', imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=240&q=80&fit=crop' },
  { id: 'cat-default-4', nameAr: 'الصحة والجمال', imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=240&q=80&fit=crop' },
  { id: 'cat-default-5', nameAr: 'المنزل', imageUrl: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=240&q=80&fit=crop' },
  { id: 'cat-default-6', nameAr: 'تاجر جملة', imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=240&q=80&fit=crop' },
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

export async function getCategories() {
  const list = await sbGetConfig('categories', null)
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  const cleaned = list
    .filter((c) => c && typeof c.id === 'string' && c.id.trim() && typeof c.nameAr === 'string' && c.nameAr.trim())
    .map((c) => ({ id: String(c.id).trim(), nameAr: String(c.nameAr).trim(), imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl.trim() : '' }))
    .slice(0, MAX_CATEGORIES)
  if (cleaned.length === 0) return DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  return ensureDefaultCategories(cleaned)
}

export async function setCategories(categories) {
  const clean = (categories || [])
    .filter((c) => c && c.id && c.nameAr)
    .slice(0, MAX_CATEGORIES)
    .map((c) => ({ id: String(c.id), nameAr: String(c.nameAr).trim(), imageUrl: String(c.imageUrl || '').trim() }))
  await sbSetConfig('categories', clean)
  notifyStoreUpdate()
}

export async function addCategory({ nameAr, imageUrl }) {
  const name = String(nameAr || '').trim()
  if (!name) return false
  const list = await getCategories()
  list.push({ id: `cat-${Date.now()}`, nameAr: name, imageUrl: String(imageUrl || '').trim() })
  await setCategories(list)
  return true
}

export async function removeCategory(categoryId) {
  await setCategories((await getCategories()).filter((c) => c.id !== String(categoryId)))
}

// ─── Admin auth ───────────────────────────────────────────────────────────────

export function getAdminPassword() {
  return import.meta.env.VITE_ADMIN_PASSWORD ?? '1988215'
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

// ─── localStorage helper (orders only) ───────────────────────────────────────

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

// ─── In-memory caches ─────────────────────────────────────────────────────────

const DEFAULT_RATING = 4.6
const DEFAULT_REVIEW_COUNT = 48
const DEFAULT_SOLD_COUNT = 320

let extraProductsCache = null
let productEditsCache = null
let trashCache = null

// ─── Supabase-backed persistence ─────────────────────────────────────────────

async function readExtraRaw() {
  if (extraProductsCache !== null) return extraProductsCache
  if (!supabase) { extraProductsCache = []; return [] }
  const { data, error } = await supabase.from('extra_products').select('id, data')
  if (error) console.error('[store] extra_products fetch error:', error)
  extraProductsCache = Array.isArray(data) ? data.map((r) => ({ ...r.data, id: r.id })) : []
  console.log('[store] extra_products loaded:', extraProductsCache.length, 'products')
  return extraProductsCache
}

async function getEditsMap() {
  if (productEditsCache !== null) return productEditsCache
  if (!supabase) { productEditsCache = {}; return {} }
  const { data } = await supabase.from('product_edits').select('product_id, data')
  productEditsCache = {}
  if (Array.isArray(data)) data.forEach((r) => { productEditsCache[r.product_id] = r.data })
  return productEditsCache
}

async function persistEdits(edits) {
  productEditsCache = edits
  if (!supabase) return
  const rows = Object.entries(edits).map(([product_id, data]) => ({ product_id, data }))
  if (rows.length > 0) await supabase.from('product_edits').upsert(rows)
}

async function persistTrash(entries) {
  const clean = entries.slice(0, MAX_TRASH_ITEMS)
  trashCache = clean
  if (!supabase) return
  if (clean.length > 0) {
    await supabase.from('trash').upsert(clean.map((t) => ({ id: t.id, deleted_at: t.deletedAt, product: t.product })))
  } else {
    await supabase.from('trash').delete().neq('id', '')
  }
}

export async function hydrateStoreCaches() {
  await Promise.all([readExtraRaw(), getEditsMap()])
  if (!supabase) { trashCache = []; return }
  const { data: trashData } = await supabase.from('trash').select('id, deleted_at, product')
  trashCache = Array.isArray(trashData)
    ? trashData.map((r) => ({ id: r.id, deletedAt: r.deleted_at, product: r.product }))
    : []
}

// ─── Product helpers ──────────────────────────────────────────────────────────

export function normalizeProductMarkets(p) {
  const m = p?.markets
  if (Array.isArray(m) && m.length > 0) {
    const ok = [...new Set(m.filter((x) => COUNTRY_IDS.includes(x)))]
    if (ok.length > 0) return ok
  }
  return ['SA', 'AE']
}

export function productAvailableInCountry(p, countryId) {
  if (!countryId || !COUNTRY_IDS.includes(countryId)) return false
  return normalizeProductMarkets(p).includes(countryId)
}

export function productVisibleForCurrency(p, currency) {
  const m = normalizeProductMarkets(p)
  if (currency === 'AED') return m.includes('AE')
  return m.includes('SA')
}

export function formatMarketsLabel(p) {
  const m = normalizeProductMarkets(p)
  const labels = m.map((id) => COUNTRIES.find((c) => c.id === id)?.nameAr).filter(Boolean)
  return labels.length ? labels.join('، ') : '—'
}

function withDefaultReviews(p) {
  const out = { ...p }
  const reviewsOk =
    typeof out.rating === 'number' && !Number.isNaN(out.rating) && out.rating >= 0 && out.rating <= 5 &&
    typeof out.reviewCount === 'number' && Number.isFinite(out.reviewCount) && out.reviewCount >= 0
  if (!reviewsOk) { out.rating = DEFAULT_RATING; out.reviewCount = DEFAULT_REVIEW_COUNT }
  if (typeof out.soldCount !== 'number' || !Number.isFinite(out.soldCount) || out.soldCount <= 0) {
    out.soldCount = DEFAULT_SOLD_COUNT
  }
  out.markets = normalizeProductMarkets(out)
  return attachLegacyMediaFields(out)
}

async function mergeWithStoredEdit(p) {
  const edits = await getEditsMap()
  const e = edits[p.id]
  return withDefaultReviews(e ? { ...p, ...e } : { ...p })
}

export async function getExtraProducts() {
  const extra = await readExtraRaw()
  return Promise.all(extra.map((p) => mergeWithStoredEdit(withDefaultReviews({ ...p }))))
}

async function buildFullProductCatalog() {
  const extra = await readExtraRaw()
  return [
    ...(await Promise.all(baseProducts.map(mergeWithStoredEdit))),
    ...(await Promise.all(extra.map((p) => mergeWithStoredEdit(withDefaultReviews({ ...p }))))),
  ]
}

async function readDeletedBaseIds() {
  const val = await sbGetConfig('deleted_base_ids', [])
  return new Set(Array.isArray(val) ? val.filter((x) => typeof x === 'string') : [])
}

export async function getMergedProducts() {
  const hiddenBase = await readDeletedBaseIds()
  const extra = await readExtraRaw()
  return [
    ...(await Promise.all(baseProducts.map(mergeWithStoredEdit))).filter((p) => !hiddenBase.has(p.id)),
    ...(await Promise.all(extra.map((p) => mergeWithStoredEdit(withDefaultReviews({ ...p }))))),
  ]
}

export function getTrash() {
  return Array.isArray(trashCache) ? trashCache : []
}

export async function softDeleteProduct(productId) {
  const id = String(productId)
  const catalog = await buildFullProductCatalog()
  const product = catalog.find((p) => p.id === id)
  if (!product) return false

  const trash = getTrash().filter((t) => t.id !== id)
  trash.unshift({ id, deletedAt: Date.now(), product: JSON.parse(JSON.stringify(product)) })
  await persistTrash(trash)

  const feat = (await getFeaturedProductIds()).filter((x) => x !== id)
  await setFeaturedProductIds(feat)

  if (id.startsWith('custom-')) {
    extraProductsCache = (await readExtraRaw()).filter((p) => p.id !== id)
    if (supabase) await supabase.from('extra_products').delete().eq('id', id)
    const edits = await getEditsMap()
    if (edits[id]) {
      delete edits[id]
      if (supabase) await supabase.from('product_edits').delete().eq('product_id', id)
    }
  } else {
    const cur = [...(await readDeletedBaseIds())]
    if (!cur.includes(id)) cur.push(id)
    await sbSetConfig('deleted_base_ids', cur)
  }

  notifyStoreUpdate()
  return true
}

export async function restoreProductFromTrash(productId) {
  const id = String(productId)
  const trash = getTrash()
  const entry = trash.find((t) => t.id === id)
  if (!entry) return false

  await persistTrash(trash.filter((t) => t.id !== id))

  if (id.startsWith('custom-')) {
    const extra = await readExtraRaw()
    if (!extra.some((p) => p.id === id)) {
      extra.push(entry.product)
      extraProductsCache = extra
      if (supabase) await supabase.from('extra_products').upsert({ id, data: entry.product })
    }
  } else {
    const cur = [...(await readDeletedBaseIds())].filter((x) => x !== id)
    await sbSetConfig('deleted_base_ids', cur)
  }

  notifyStoreUpdate()
  return true
}

export async function purgeTrashEntry(productId) {
  const id = String(productId)
  trashCache = getTrash().filter((t) => t.id !== id)
  if (supabase) await supabase.from('trash').delete().eq('id', id)
  notifyStoreUpdate()
  return true
}

export async function removeProductEdit(productId) {
  const id = String(productId)
  const edits = await getEditsMap()
  if (!edits[id]) return
  delete edits[id]
  productEditsCache = edits
  if (supabase) await supabase.from('product_edits').delete().eq('product_id', id)
  notifyStoreUpdate()
}

export async function saveProduct(productId, payload) {
  try {
    const id = String(productId)
    if (id.startsWith('custom-')) {
      const raw = await readExtraRaw()
      const idx = raw.findIndex((p) => p.id === id)
      if (idx < 0) return false
      raw[idx] = { ...raw[idx], ...payload }
      extraProductsCache = raw
      if (supabase) await supabase.from('extra_products').upsert({ id, data: raw[idx] })
      const edits = await getEditsMap()
      if (edits[id]) {
        delete edits[id]
        if (supabase) await supabase.from('product_edits').delete().eq('product_id', id)
      }
    } else {
      const edits = await getEditsMap()
      edits[id] = { ...(edits[id] || {}), ...payload }
      await persistEdits(edits)
    }
    notifyStoreUpdate()
    return true
  } catch {
    return false
  }
}

export async function getFeaturedProductIds() {
  const list = await sbGetConfig('featured_product_ids', [])
  if (!Array.isArray(list)) return []
  return [...new Set(list.filter((id) => typeof id === 'string' && id.trim()))]
}

export async function setFeaturedProductIds(ids) {
  const clean = [...new Set((ids || []).filter((id) => typeof id === 'string' && id.trim()))]
  await sbSetConfig('featured_product_ids', clean)
  notifyStoreUpdate()
}

export async function toggleFeaturedProductId(productId) {
  const id = String(productId)
  const cur = await getFeaturedProductIds()
  const set = new Set(cur)
  if (set.has(id)) {
    await setFeaturedProductIds(cur.filter((x) => x !== id))
  } else {
    await setFeaturedProductIds([...cur, id])
  }
}

export async function addExtraProduct(product) {
  try {
    const id = `custom-${Date.now()}`
    const p = withDefaultReviews({ ...product, id })
    const extra = await readExtraRaw()
    extra.push(p)
    extraProductsCache = extra
    if (supabase) await supabase.from('extra_products').insert({ id, data: p })
    notifyStoreUpdate()
    return true
  } catch {
    return false
  }
}

export async function removeExtraProduct(id) {
  if (!String(id).startsWith('custom-')) return
  extraProductsCache = (await readExtraRaw()).filter((p) => p.id !== id)
  if (supabase) await supabase.from('extra_products').delete().eq('id', id)
  notifyStoreUpdate()
}

// ─── Orders (Supabase — shared across devices) ───────────────────────────────

export async function getOrders() {
  if (!supabase) {
    const list = readJson('taager_orders', [])
    return Array.isArray(list) ? list : []
  }
  const { data, error } = await supabase
    .from('orders')
    .select('*')
  if (error) {
    console.error('[getOrders] Supabase error:', error)
    return []
  }
  const rows = Array.isArray(data) ? data.map((r) => ({
    id: r.id,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : (r.order_ts ?? 0),
    status: r.status,
    productId: r.product_id,
    productTitle: r.product_title,
    name: r.name,
    phone: r.phone,
    city: r.city,
    currency: r.currency,
    quantity: r.quantity,
    priceSar: r.price_sar,
    priceAed: r.price_aed,
    unitPriceSar: r.unit_price_sar,
    unitPriceAed: r.unit_price_aed,
    lineTotalSar: r.line_total_sar,
    lineTotalAed: r.line_total_aed,
    validatedAt: r.validated_at,
    ...( r.data || {}),
  })) : []
  return rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function updateOrder(id, patch) {
  if (!supabase) {
    const orders = readJson('taager_orders', [])
    const idx = orders.findIndex((o) => o.id === id)
    if (idx < 0) return false
    orders[idx] = { ...orders[idx], ...patch }
    localStorage.setItem('taager_orders', JSON.stringify(orders))
    notifyStoreUpdate()
    return true
  }
  const dbPatch = {}
  if (patch.status !== undefined) dbPatch.status = patch.status
  if (patch.validatedAt !== undefined) dbPatch.validated_at = patch.validatedAt
  await supabase.from('orders').update(dbPatch).eq('id', id)
  notifyStoreUpdate()
  return true
}

export async function removeOrder(id) {
  if (!supabase) {
    const orders = readJson('taager_orders', []).filter((o) => o.id !== id)
    localStorage.setItem('taager_orders', JSON.stringify(orders))
    notifyStoreUpdate()
    return
  }
  await supabase.from('orders').delete().eq('id', id)
  notifyStoreUpdate()
}

export async function addOrder(order) {
  const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const row = { ...order, id, createdAt: Date.now(), status: 'pending' }
  if (!supabase) {
    const orders = readJson('taager_orders', [])
    orders.unshift(row)
    localStorage.setItem('taager_orders', JSON.stringify(orders))
    notifyStoreUpdate()
    return
  }
  const { error } = await supabase.from('orders').insert({
    id,
    status: 'pending',
    product_id: order.productId,
    product_title: order.productTitle,
    name: order.name,
    phone: order.phone,
    city: order.city,
    currency: order.currency,
    quantity: order.quantity ?? 1,
    price_sar: order.priceSar,
    price_aed: order.priceAed,
    unit_price_sar: order.unitPriceSar,
    unit_price_aed: order.unitPriceAed,
    line_total_sar: order.lineTotalSar,
    line_total_aed: order.lineTotalAed,
    data: order,
  })
  if (error) {
    console.error('[addOrder] Supabase error:', error)
    // fallback to localStorage if Supabase fails
    const orders = readJson('taager_orders', [])
    orders.unshift(row)
    localStorage.setItem('taager_orders', JSON.stringify(orders))
  }
  notifyStoreUpdate()
}

export function notifyStoreUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('taager-store-update'))
  }
}

