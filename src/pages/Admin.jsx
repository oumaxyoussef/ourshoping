import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MAX_IMAGE_FILE_BYTES,
  MAX_PHOTOS,
  MAX_VIDEO_FILE_BYTES,
  MAX_VIDEOS,
  getProductPhotos,
  getProductVideos,
  isValidImageRef,
  isValidVideoRef,
  mediaSummaryText,
  readFilesAsDataUrls,
} from '../lib/productMedia.js'
import { productLandingPath } from '../lib/productUrl.js'
import { MAX_QUANTITY_PROMOS } from '../lib/quantityPromos.js'
import {
  addExtraProduct,
  adminLogin,
  adminLogout,
  formatMarketsLabel,
  getExtraProducts,
  addCategory,
  getCategories,
  getFeaturedProductIds,
  getHeaderBanners,
  getMergedProducts,
  getOrders,
  getTrash,
  isAdminLoggedIn,
  normalizeProductMarkets,
  MAX_CATEGORIES,
  MAX_HEADER_BANNERS,
  removeCategory,
  purgeTrashEntry,
  removeOrder,
  removeProductEdit,
  resetHeaderBannersToDefault,
  saveProduct,
  setFeaturedProductIds,
  setHeaderBanners,
  softDeleteProduct,
  toggleFeaturedProductId,
  updateOrder,
  restoreProductFromTrash,
} from '../lib/store.js'
import { supabase } from '../lib/supabase.js'
import { COUNTRIES, currencyForCountry } from '../lib/countries.js'
import { formatMoney } from '../lib/money.js'
import {
  convertCurrencyToSar,
  convertSarToCurrency,
  deriveAedFromSar,
} from '../lib/pricing.js'

const DEFAULT_REVIEW_FORM = {
  rating: '4.6',
  reviewCount: '48',
  soldCount: '320',
}

const CURRENCY_META = {
  SAR: { nameAr: 'ريال سعودي' },
  AED: { nameAr: 'درهم إماراتي' },
  EGP: { nameAr: 'جنيه مصري' },
  IQD: { nameAr: 'دينار عراقي' },
  OMR: { nameAr: 'ريال عُماني' },
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString('ar-SA', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return String(ts)
  }
}

function TrashIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

function orderStatusLabel(status) {
  if (status === 'validated') return 'مؤكد'
  return 'قيد المراجعة'
}

function orderMoneyLine(o) {
  const qty = o.quantity ?? 1
  const totalSar = o.lineTotalSar ?? o.priceSar
  const totalAed = o.lineTotalAed ?? o.priceAed
  const cur = o.currency || 'SAR'
  let total
  let unit
  if (cur === 'SAR') {
    total = totalSar
    unit = o.unitPriceSar ?? (qty > 0 ? totalSar / qty : totalSar)
  } else if (cur === 'AED') {
    total = totalAed
    unit = o.unitPriceAed ?? (qty > 0 ? totalAed / qty : totalAed)
  } else {
    total = convertSarToCurrency(totalSar, cur)
    const uSar = o.unitPriceSar ?? (qty > 0 ? totalSar / qty : totalSar)
    unit = convertSarToCurrency(uSar, cur)
  }
  if (qty > 1) {
    return `${qty} × ${formatMoney(unit, cur)} = ${formatMoney(total, cur)}`
  }
  return formatMoney(total, cur)
}

export default function Admin() {
  const [logged, setLogged] = useState(() => isAdminLoggedIn())
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [orders, setOrders] = useState([])
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [extra, setExtra] = useState([])
  const [featuredIds, setFeaturedIds] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [editingProductId, setEditingProductId] = useState(null)
  const [storeTick, setStoreTick] = useState(0)

  const productThumbByProductId = useMemo(() => {
    const m = new Map()
    for (const p of allProducts) {
      const u = getProductPhotos(p)[0]
      m.set(p.id, u ?? null)
    }
    return m
  }, [allProducts, storeTick])

  const [newProduct, setNewProduct] = useState({
    title: '',
    productCode: '',
    description: '',
    marketCountries: ['SA', 'AE'],
    priceCurrency: 'SAR',
    categoryId: '',
    priceSar: '',
    oldPriceSar: '',
    ...DEFAULT_REVIEW_FORM,
  })
  const [photoItems, setPhotoItems] = useState([])
  const [videoItems, setVideoItems] = useState([])
  const [photoUrlDraft, setPhotoUrlDraft] = useState('')
  const [videoUrlDraft, setVideoUrlDraft] = useState('')
  const [qtyPromoRows, setQtyPromoRows] = useState([])
  const [productMsg, setProductMsg] = useState('')
  const [bannerUrls, setBannerUrls] = useState([])
  const [bannerUrlDraft, setBannerUrlDraft] = useState('')
  const [bannerMsg, setBannerMsg] = useState('')
  const [shopCategories, setShopCategories] = useState([])
  const [newCatName, setNewCatName] = useState('')
  const [newCatImgDraft, setNewCatImgDraft] = useState('')
  const [newCatImgUrl, setNewCatImgUrl] = useState('')
  const [catMsg, setCatMsg] = useState('')
  const [trashList, setTrashList] = useState(() => getTrash())
  const [trashOpen, setTrashOpen] = useState(false)
  const [newOrderAlert, setNewOrderAlert] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    Promise.all([getExtraProducts(), getFeaturedProductIds(), getHeaderBanners(), getCategories(), getMergedProducts(), getOrders()])
      .then(([xtra, featured, banners, cats, products, ords]) => {
        setExtra(xtra)
        setFeaturedIds(featured)
        setBannerUrls(banners)
        setShopCategories(cats)
        setAllProducts(products)
        setOrders(ords)
      })
  }, [])

  useEffect(() => {
    const sync = async () => {
      const [xtra, featured, banners, cats, products, ords] = await Promise.all([
        getExtraProducts(), getFeaturedProductIds(), getHeaderBanners(), getCategories(), getMergedProducts(), getOrders()
      ])
      setOrders(ords)
      setExtra(xtra)
      setFeaturedIds(featured)
      setBannerUrls(banners)
      setShopCategories(cats)
      setAllProducts(products)
      setTrashList(getTrash())
      setStoreTick((t) => t + 1)
    }
    window.addEventListener('taager-store-update', sync)
    return () => window.removeEventListener('taager-store-update', sync)
  }, [])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async () => {
        const ords = await getOrders()
        setOrders(ords)
        setNewOrderAlert(true)
        try { audioRef.current?.play() } catch {}
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const resetProductForm = () => {
    setEditingProductId(null)
    setNewProduct({
      title: '',
      productCode: '',
      description: '',
      marketCountries: ['SA', 'AE'],
      priceCurrency: 'SAR',
      categoryId: '',
      priceSar: '',
      oldPriceSar: '',
      ...DEFAULT_REVIEW_FORM,
    })
    setPhotoItems([])
    setVideoItems([])
    setPhotoUrlDraft('')
    setVideoUrlDraft('')
    setQtyPromoRows([])
  }

  const beginEditProduct = (p) => {
    setProductMsg('')
    setEditingProductId(p.id)
    const mk = normalizeProductMarkets(p)
    const editCurrency =
      typeof p.priceInputCurrency === 'string'
        ? p.priceInputCurrency
        : currencyForCountry(mk[0] || 'SA')
    setNewProduct({
      title: p.title,
      productCode: typeof p.productCode === 'string' ? p.productCode : '',
      description: p.description === '—' ? '' : p.description,
      marketCountries: mk.length ? [...mk] : ['SA', 'AE'],
      priceCurrency: editCurrency,
      categoryId: p.categoryId ? String(p.categoryId) : '',
      priceSar: String(convertSarToCurrency(Number(p.priceSar), editCurrency)),
      oldPriceSar: String(convertSarToCurrency(Number(p.oldPriceSar), editCurrency)),
      rating: String(p.rating ?? ''),
      reviewCount: String(p.reviewCount ?? ''),
      soldCount: String(p.soldCount ?? ''),
    })
    setPhotoItems(getProductPhotos(p).slice(0, MAX_PHOTOS))
    setVideoItems(getProductVideos(p).slice(0, MAX_VIDEOS))
    setQtyPromoRows(
      (p.quantityPromos || []).map((row) => ({
        quantity: String(row.quantity),
        priceSar: String(convertSarToCurrency(Number(row.priceSar), editCurrency)),
      })),
    )
    setPhotoUrlDraft('')
    setVideoUrlDraft('')
    document.getElementById('admin-product-form')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const handleLogin = (e) => {
    e.preventDefault()
    setLoginError('')
    if (adminLogin(password)) {
      setLogged(true)
      setPassword('')
    } else {
      setLoginError('كلمة المرور غير صحيحة')
    }
  }

  const handleLogout = () => {
    adminLogout()
    setLogged(false)
  }

  const handlePhotoFiles = async (e) => {
    const { files } = e.target
    if (!files?.length) return
    setProductMsg('')
    const room = MAX_PHOTOS - photoItems.length
    if (room <= 0) {
      setProductMsg(`الحد الأقصى ${MAX_PHOTOS} صور`)
      e.target.value = ''
      return
    }
    try {
      const urls = await readFilesAsDataUrls(files, {
        maxCount: room,
        maxBytesPerFile: MAX_IMAGE_FILE_BYTES,
        acceptPrefix: 'image/',
      })
      setPhotoItems((prev) => [...prev, ...urls].slice(0, MAX_PHOTOS))
    } catch (err) {
      setProductMsg(err?.message || 'خطأ في رفع الصور')
    }
    e.target.value = ''
  }

  const handleVideoFiles = async (e) => {
    const { files } = e.target
    if (!files?.length) return
    setProductMsg('')
    const room = MAX_VIDEOS - videoItems.length
    if (room <= 0) {
      setProductMsg(`الحد الأقصى ${MAX_VIDEOS} فيديوهات`)
      e.target.value = ''
      return
    }
    try {
      const urls = await readFilesAsDataUrls(files, {
        maxCount: room,
        maxBytesPerFile: MAX_VIDEO_FILE_BYTES,
        acceptPrefix: 'video/',
      })
      setVideoItems((prev) => [...prev, ...urls].slice(0, MAX_VIDEOS))
    } catch (err) {
      setProductMsg(err?.message || 'خطأ في رفع الفيديو')
    }
    e.target.value = ''
  }

  const handleBannerFiles = async (e) => {
    const { files } = e.target
    if (!files?.length) return
    setBannerMsg('')
    const room = MAX_HEADER_BANNERS - bannerUrls.length
    if (room <= 0) {
      setBannerMsg(`الحد الأقصى ${MAX_HEADER_BANNERS} صور للبانر`)
      e.target.value = ''
      return
    }
    try {
      const urls = await readFilesAsDataUrls(files, {
        maxCount: room,
        maxBytesPerFile: MAX_IMAGE_FILE_BYTES,
        acceptPrefix: 'image/',
      })
      setBannerUrls((prev) => [...prev, ...urls].slice(0, MAX_HEADER_BANNERS))
    } catch (err) {
      setBannerMsg(err?.message || 'خطأ في رفع الصور')
    }
    e.target.value = ''
  }

  const addBannerFromUrl = () => {
    const u = bannerUrlDraft.trim()
    if (!u) return
    setBannerMsg('')
    if (!isValidImageRef(u)) {
      setBannerMsg('رابط الصورة غير صالح')
      return
    }
    if (bannerUrls.length >= MAX_HEADER_BANNERS) {
      setBannerMsg(`الحد الأقصى ${MAX_HEADER_BANNERS} صور`)
      return
    }
    setBannerUrls((prev) => [...prev, u].slice(0, MAX_HEADER_BANNERS))
    setBannerUrlDraft('')
  }

  const saveBanners = () => {
    setHeaderBanners(bannerUrls)
    setBannerMsg('تم حفظ بانر الصفحة الرئيسية.')
  }

  const resetBanners = async () => {
    await resetHeaderBannersToDefault()
    setBannerUrls(await getHeaderBanners())
    setBannerMsg('تمت استعادة الصور الافتراضية.')
  }

  const handleNewCategoryImage = async (e) => {
    const { files } = e.target
    if (!files?.length) return
    setCatMsg('')
    try {
      const urls = await readFilesAsDataUrls(files, {
        maxCount: 1,
        maxBytesPerFile: MAX_IMAGE_FILE_BYTES,
        acceptPrefix: 'image/',
      })
      if (urls[0]) setNewCatImgDraft(urls[0])
    } catch (err) {
      setCatMsg(err?.message || 'خطأ في الصورة')
    }
    e.target.value = ''
  }

  const submitNewCategory = async (e) => {
    e.preventDefault()
    setCatMsg('')
    const name = newCatName.trim()
    if (!name) {
      setCatMsg('أدخل اسم التصنيف')
      return
    }
    const img = (newCatImgUrl.trim() || newCatImgDraft || '').trim()
    if (!img) {
      setCatMsg('أضف صورة: رفع من الجهاز أو لصق رابط صالح')
      return
    }
    if (newCatImgUrl.trim() && !isValidImageRef(newCatImgUrl.trim())) {
      setCatMsg('رابط الصورة غير صالح')
      return
    }
    if (shopCategories.length >= MAX_CATEGORIES) {
      setCatMsg(`الحد الأقصى ${MAX_CATEGORIES} تصنيفات`)
      return
    }
    await addCategory({ nameAr: name, imageUrl: newCatImgUrl.trim() || newCatImgDraft })
    setNewCatName('')
    setNewCatImgDraft('')
    setNewCatImgUrl('')
    setShopCategories(await getCategories())
    setCatMsg('تمت إضافة التصنيف.')
  }

  const addPhotoFromUrl = () => {
    const u = photoUrlDraft.trim()
    if (!u) return
    setProductMsg('')
    if (!isValidImageRef(u)) {
      setProductMsg('رابط الصورة غير صالح')
      return
    }
    if (photoItems.length >= MAX_PHOTOS) {
      setProductMsg(`الحد الأقصى ${MAX_PHOTOS} صور`)
      return
    }
    setPhotoItems((prev) => [...prev, u])
    setPhotoUrlDraft('')
  }

  const addVideoFromUrl = () => {
    const u = videoUrlDraft.trim()
    if (!u) return
    setProductMsg('')
    if (!isValidVideoRef(u)) {
      setProductMsg('رابط الفيديو غير صالح (mp4/webm/YouTube)')
      return
    }
    if (videoItems.length >= MAX_VIDEOS) {
      setProductMsg(`الحد الأقصى ${MAX_VIDEOS} فيديوهات`)
      return
    }
    setVideoItems((prev) => [...prev, u])
    setVideoUrlDraft('')
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    setProductMsg('')
    const inputCurrency = newProduct.priceCurrency || 'SAR'
    const inputPrice = Number(newProduct.priceSar)
    const inputOldPrice = Number(newProduct.oldPriceSar)
    if (!newProduct.title.trim()) {
      setProductMsg('عنوان المنتج مطلوب')
      return
    }
    if (photoItems.length === 0) {
      setProductMsg(`أضف صورة واحدة على الأقل (حتى ${MAX_PHOTOS} صور)`)
      return
    }
    if ([inputPrice, inputOldPrice].some((n) => Number.isNaN(n) || n < 0)) {
      setProductMsg('أدخل أسعاراً صالحة (أرقام 0 أو أكبر)')
      return
    }
    const priceSar = convertCurrencyToSar(inputPrice, inputCurrency)
    const oldPriceSar = convertCurrencyToSar(inputOldPrice, inputCurrency)
    if (priceSar > oldPriceSar) {
      setProductMsg(
        'السعر الحالي لا يمكن أن يكون أكبر من «قبل الخصم». إن لم يكن هناك خصم، اجعل الحقلين متساويين.',
      )
      return
    }

    const { priceAed, oldPriceAed } = deriveAedFromSar(priceSar, oldPriceSar)

    const ratingStr = newProduct.rating.trim()
    const reviewStr = newProduct.reviewCount.trim()
    const soldStr = newProduct.soldCount.trim()
    const wantsReviews = ratingStr !== '' || reviewStr !== ''

    if (wantsReviews) {
      if (ratingStr === '' || reviewStr === '') {
        setProductMsg('التقييم وعدد الآراء مطلوبان معاً إن أدخلت أحدهما')
        return
      }
      if (!/^\d+$/.test(reviewStr)) {
        setProductMsg('عدد الآراء يجب أن يكون رقماً صحيحاً بدون كسور')
        return
      }
      const rating = Number(ratingStr)
      const reviewCount = Number.parseInt(reviewStr, 10)
      if (
        Number.isNaN(rating) ||
        rating < 0 ||
        rating > 5 ||
        Number.isNaN(reviewCount) ||
        reviewCount < 0
      ) {
        setProductMsg('التقييم من 0 إلى 5، وعدد الآراء ≥ 0')
        return
      }
    }

    if (soldStr !== '') {
      if (!/^\d+$/.test(soldStr)) {
        setProductMsg('عدد المبيعات يجب أن يكون رقماً صحيحاً')
        return
      }
      const sold = Number.parseInt(soldStr, 10)
      if (Number.isNaN(sold) || sold < 0) {
        setProductMsg('عدد المبيعات يجب أن يكون ≥ 0')
        return
      }
    }

    const photos = photoItems.slice(0, MAX_PHOTOS)
    const videos = videoItems.slice(0, MAX_VIDEOS)
    for (const u of photos) {
      if (!isValidImageRef(u)) {
        setProductMsg('إحدى الصور غير صالحة')
        return
      }
    }
    for (const u of videos) {
      if (!isValidVideoRef(u)) {
        setProductMsg('أحد الفيديوهات غير صالح')
        return
      }
    }

    const payload = {
      title: newProduct.title.trim(),
      description: newProduct.description.trim() || '—',
      photos,
      videos,
      priceSar,
      priceAed,
      oldPriceSar,
      oldPriceAed,
      productCode: newProduct.productCode.trim(),
      priceInputCurrency: inputCurrency,
    }

    if (wantsReviews) {
      payload.rating = Number(ratingStr)
      payload.reviewCount = Number.parseInt(reviewStr, 10)
    }
    if (soldStr !== '') {
      payload.soldCount = Number.parseInt(soldStr, 10)
    }
    const mc = Array.isArray(newProduct.marketCountries)
      ? [...new Set(newProduct.marketCountries)]
      : []
    if (mc.length === 0) {
      setProductMsg('اختر دولة واحدة على الأقل لعرض المنتج')
      return
    }
    payload.markets = mc

    payload.categoryId = newProduct.categoryId
      ? String(newProduct.categoryId)
      : ''

    const promos = []
    for (const row of qtyPromoRows) {
      const empty =
        !String(row.quantity ?? '').trim() && !String(row.priceSar ?? '').trim()
      if (empty) continue
      const q = Number.parseInt(String(row.quantity).trim(), 10)
      const promoInputTotal = Number(row.priceSar)
      const ps = convertCurrencyToSar(promoInputTotal, inputCurrency)
      const pa = convertSarToCurrency(ps, 'AED')
      if (
        !Number.isInteger(q) ||
        q < 2 ||
        !Number.isFinite(promoInputTotal) ||
        promoInputTotal <= 0
      ) {
        setProductMsg(
          'خصم الكميات: كل بند يحتاج عدد قطع ≥ 2 وإجمالي سعر صالح',
        )
        return
      }
      if (ps >= q * priceSar) {
        setProductMsg(
          `سعر الباقة لـ ${q} قطع يجب أن يكون أقل من ${q} × السعر الواحد (ر.س)`,
        )
        return
      }
      promos.push({ quantity: q, priceSar: ps, priceAed: pa })
    }
    if (new Set(promos.map((x) => x.quantity)).size !== promos.length) {
      setProductMsg('لا تكرر نفس عدد القطع في بندين مختلفين')
      return
    }
    promos.sort((a, b) => a.quantity - b.quantity)
    if (promos.length > MAX_QUANTITY_PROMOS) {
      setProductMsg(`الحد الأقصى ${MAX_QUANTITY_PROMOS} بنود خصم كمية`)
      return
    }
    if (promos.length > 0) {
      payload.quantityPromos = promos
    } else if (editingProductId) {
      payload.quantityPromos = []
    }

    if (editingProductId) {
      const ok = await saveProduct(editingProductId, payload)
      if (!ok) {
        setProductMsg('تعذر حفظ التعديلات. أعد المحاولة أو حدّث الصفحة.')
        return
      }
      resetProductForm()
      setProductMsg('تم حفظ التعديلات.')
      setExtra(await getExtraProducts())
      return
    }

    const added = await addExtraProduct(payload)
    if (!added) {
      setProductMsg('تعذر حفظ المنتج. أعد المحاولة أو حدّث الصفحة.')
      return
    }
    resetProductForm()
    setProductMsg('تمت إضافة المنتج.')
    setExtra(await getExtraProducts())
  }

  const availableInputCurrencies = useMemo(() => {
    const set = new Set(
      (newProduct.marketCountries || [])
        .map((cid) => currencyForCountry(cid))
        .filter(Boolean),
    )
    set.add(newProduct.priceCurrency || 'SAR')
    return [...set]
  }, [newProduct.marketCountries, newProduct.priceCurrency])

  const currentCurrencySuffix = useMemo(() => {
    const sample = formatMoney(1, newProduct.priceCurrency || 'SAR')
    return sample.replace(/^1\s*/, '').trim()
  }, [newProduct.priceCurrency])

  const shiftDraftCurrency = (nextCurrency) => {
    const from = newProduct.priceCurrency || 'SAR'
    if (!nextCurrency || from === nextCurrency) {
      setNewProduct((prev) => ({ ...prev, priceCurrency: nextCurrency || from }))
      return
    }
    const convertDraft = (v) => {
      const t = String(v ?? '').trim()
      if (!t) return ''
      const n = Number(t)
      if (!Number.isFinite(n)) return ''
      const sar = convertCurrencyToSar(n, from)
      return String(convertSarToCurrency(sar, nextCurrency))
    }
    setNewProduct((prev) => ({
      ...prev,
      priceCurrency: nextCurrency,
      priceSar: convertDraft(prev.priceSar),
      oldPriceSar: convertDraft(prev.oldPriceSar),
    }))
    setQtyPromoRows((rows) =>
      rows.map((row) => ({ ...row, priceSar: convertDraft(row.priceSar) })),
    )
  }

  if (!logged) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-12" dir="rtl">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-2 text-2xl font-extrabold text-gray-900">لوحة الإدارة</h1>
          <p className="mb-6 text-sm text-gray-600">
            أدخل كلمة المرور. (للتجربة: القيمة الافتراضية{' '}
            <code className="rounded bg-gray-100 px-1">admin123</code> — غيّرها عبر{' '}
            <code className="rounded bg-gray-100 px-1">VITE_ADMIN_PASSWORD</code> في ملف{' '}
            <code className="rounded bg-gray-100 px-1">.env</code>)
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-pass" className="mb-1 block text-sm font-bold">
                كلمة المرور
              </label>
              <input
                id="admin-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-temu"
                autoComplete="current-password"
              />
            </div>
            {loginError && (
              <p className="text-sm font-semibold text-red-600">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-full bg-temu py-3 font-extrabold text-white hover:bg-temu-dark"
            >
              دخول
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/" className="text-temu underline">
              العودة للمتجر
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12" dir="rtl">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="none" />
      {newOrderAlert && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-green-600 px-4 py-3 text-white shadow-lg">
          <span className="font-extrabold text-lg">🛒 طلب جديد وصل!</span>
          <button
            type="button"
            onClick={() => setNewOrderAlert(false)}
            className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold hover:bg-white/30"
          >
            إخفاء
          </button>
        </div>
      )}
      <header className={`border-b border-gray-200 bg-white ${newOrderAlert ? 'mt-14' : ''}`}>
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-xl font-extrabold text-gray-900">لوحة الإدارة</h1>
          <div className="flex gap-2">
            <Link
              to="/"
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              المتجر
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full bg-gray-800 px-4 py-2 text-sm font-bold text-white hover:bg-gray-900"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        <section>
          <h2 className="mb-2 text-lg font-extrabold text-gray-900">
            بانر الصفحة الرئيسية (سلايدر تلقائي)
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            الصور تظهر خلف قسم «أقل الأسعار في الخليج» وتتبدّل تلقائياً مع نفس البلوك (مثل
            تاجر). الحد الأقصى {MAX_HEADER_BANNERS} صور.
          </p>
          <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-full bg-temu px-4 py-2 text-sm font-bold text-white hover:bg-temu-dark">
                رفع صور
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handleBannerFiles}
                />
              </label>
              <span className="self-center text-xs text-gray-600">
                {bannerUrls.length} / {MAX_HEADER_BANNERS}
              </span>
            </div>
            <div className="mb-3 flex gap-2">
              <input
                type="url"
                value={bannerUrlDraft}
                onChange={(e) => setBannerUrlDraft(e.target.value)}
                placeholder="https://... رابط صورة"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-temu"
              />
              <button
                type="button"
                onClick={addBannerFromUrl}
                className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold hover:bg-gray-50"
              >
                إضافة رابط
              </button>
            </div>
            {bannerUrls.length > 0 && (
              <ul className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {bannerUrls.map((src, i) => (
                  <li key={`${i}-${src.slice(0, 30)}`} className="relative overflow-hidden rounded-lg border bg-white">
                    <img
                      src={src}
                      alt=""
                      className="aspect-[21/9] w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setBannerUrls((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="absolute start-1 top-1 rounded bg-red-600 px-1.5 text-xs font-bold text-white"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {bannerMsg && (
              <p
                className={`mb-3 text-sm font-semibold ${bannerMsg.includes('تم') ? 'text-green-700' : 'text-red-600'}`}
              >
                {bannerMsg}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveBanners}
                className="rounded-full bg-temu px-5 py-2 text-sm font-extrabold text-white hover:bg-temu-dark"
              >
                حفظ البانرات
              </button>
              <button
                type="button"
                onClick={resetBanners}
                className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                استعادة الافتراضي
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-extrabold text-gray-900">تصنيفات المتجر</h2>
          <p className="mb-4 text-sm text-gray-600">
            أضف تصنيفاً مع صورة؛ ثم عند إضافة أو تعديل منتج اختر التصنيف من القائمة. يظهر
            للزوار في الشريط الجانبي تحت «جميع التصنيفات».
          </p>
          <form
            onSubmit={submitNewCategory}
            className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-bold">اسم التصنيف</label>
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-temu"
                  placeholder="مثال: عروض اليوم"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">صورة التصنيف</label>
                <label className="inline-flex cursor-pointer rounded-full border-2 border-dashed border-gray-300 px-4 py-2 text-sm font-bold hover:border-temu">
                  رفع صورة
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleNewCategoryImage}
                  />
                </label>
                {newCatImgDraft && (
                  <img
                    src={newCatImgDraft}
                    alt=""
                    className="mt-2 h-16 w-16 rounded-lg border object-cover"
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">أو رابط الصورة</label>
                <input
                  type="url"
                  value={newCatImgUrl}
                  onChange={(e) => setNewCatImgUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-temu"
                />
              </div>
            </div>
            {catMsg && (
              <p
                className={`mt-2 text-sm font-semibold ${catMsg.includes('تم') ? 'text-green-700' : 'text-red-600'}`}
              >
                {catMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={shopCategories.length >= MAX_CATEGORIES}
              className="mt-3 rounded-full bg-temu px-6 py-2 text-sm font-extrabold text-white hover:bg-temu-dark disabled:opacity-40"
            >
              إضافة التصنيف ({shopCategories.length}/{MAX_CATEGORIES})
            </button>
          </form>
          <ul className="grid gap-2 sm:grid-cols-2">
            {shopCategories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed bg-white text-xs text-gray-400">
                    —
                  </div>
                )}
                <span className="min-w-0 flex-1 font-semibold text-gray-900">{c.nameAr}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await removeCategory(c.id)
                    setShopCategories(await getCategories())
                  }}
                  className="shrink-0 text-sm font-bold text-red-600 hover:underline"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-extrabold text-gray-900">
              <TrashIcon className="h-6 w-6 shrink-0 text-slate-600" />
              سلة المحذوفات
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-sm tabular-nums text-slate-800">
                {trashList.length}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setTrashOpen((o) => !o)}
              className="rounded-full border-2 border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            >
              {trashOpen ? 'إخفاء' : 'عرض المحتوى'}
            </button>
          </div>
          {!trashOpen && (
            <p className="mt-3 text-sm text-gray-500">
              اضغط «عرض المحتوى» لرؤية المنتجات المحذوفة واستعادتها أو حذفها نهائياً.
            </p>
          )}
          {trashOpen && (
            <>
              <p className="mb-4 mt-3 text-sm text-gray-600">
                المنتجات التي نقلتها من المتجر تظهر هنا. يمكن{' '}
                <span className="font-bold">استعادتها</span> أو{' '}
                <span className="font-bold">حذفها نهائياً</span> من السجل.
              </p>
              {trashList.length === 0 ? (
                <p className="text-sm text-gray-500">لا يوجد شيء في السلة.</p>
              ) : (
                <ul className="space-y-2">
                  {trashList.map((entry) => (
                    <li
                      key={`${entry.id}-${entry.deletedAt}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white bg-white px-3 py-2.5 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gray-900">
                          {entry.product?.title ?? entry.id}
                        </p>
                        <p className="font-mono text-[10px] text-gray-400">{entry.id}</p>
                        <p className="text-xs text-gray-500">
                          حُذف في: {formatDate(entry.deletedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await restoreProductFromTrash(entry.id)
                            setTrashList(getTrash())
                            setExtra(await getExtraProducts())
                            setFeaturedIds(await getFeaturedProductIds())
                            setStoreTick((t) => t + 1)
                            setProductMsg('تمت استعادة المنتج إلى المتجر.')
                          }}
                          className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-green-700"
                        >
                          استعادة
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('حذف هذا السجل نهائياً من السلة؟')) return
                            await purgeTrashEntry(entry.id)
                            setTrashList(getTrash())
                            setProductMsg('تم حذف السجل من السلة.')
                          }}
                          className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-extrabold text-red-600 hover:bg-red-50"
                        >
                          حذف نهائي
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-extrabold text-gray-900">الطلبات</h2>
          {orders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
              لا توجد طلبات بعد. الطلبات تُحفظ محلياً في المتصفح عند تأكيد الزبون للطلب.
            </p>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => {
                const status = o.status ?? 'pending'
                const open = expandedOrderId === o.id
                const thumb =
                  o.productId != null
                    ? productThumbByProductId.get(o.productId)
                    : null
                return (
                  <li
                    key={o.id}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrderId((id) => (id === o.id ? null : o.id))
                      }
                      className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-start hover:bg-gray-50/80"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-100 text-xs text-gray-400"
                          aria-hidden
                        >
                          —
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-gray-900">{o.productTitle}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              status === 'validated'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {orderStatusLabel(status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {o.name} — {o.phone}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-temu">
                          {orderMoneyLine(o)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-gray-400">
                          {formatDate(o.createdAt)}
                        </span>
                        <span className="text-xs font-bold text-temu">
                          {open ? '▼ إخفاء' : '◀ عرض التفاصيل'}
                        </span>
                      </div>
                    </button>
                    {open && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 text-sm">
                        <dl className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-bold text-gray-500">
                              رقم الطلب
                            </dt>
                            <dd className="font-mono text-gray-900">{o.id}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold text-gray-500">
                              معرف المنتج
                            </dt>
                            <dd className="font-mono text-gray-900">
                              {o.productId ?? '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold text-gray-500">الاسم</dt>
                            <dd className="text-gray-900">{o.name}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold text-gray-500">الجوال</dt>
                            <dd className="text-gray-900" dir="ltr">
                              {o.phone}
                            </dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-xs font-bold text-gray-500">المدينة</dt>
                            <dd className="text-gray-900">{o.city}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold text-gray-500">العملة</dt>
                            <dd className="text-gray-900">{o.currency}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-bold text-gray-500">الكمية</dt>
                            <dd className="text-gray-900">{o.quantity ?? 1}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-xs font-bold text-gray-500">المبلغ</dt>
                            <dd className="font-bold text-temu">{orderMoneyLine(o)}</dd>
                          </div>
                          {status === 'validated' && o.validatedAt != null && (
                            <div className="sm:col-span-2">
                              <dt className="text-xs font-bold text-gray-500">
                                تاريخ التأكيد
                              </dt>
                              <dd className="text-gray-700">
                                {formatDate(o.validatedAt)}
                              </dd>
                            </div>
                          )}
                        </dl>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {status !== 'validated' && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation()
                                await updateOrder(o.id, {
                                  status: 'validated',
                                  validatedAt: Date.now(),
                                })
                                setOrders(await getOrders())
                              }}
                              className="rounded-full bg-green-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-green-700"
                            >
                              تأكيد الطلب
                            </button>
                          )}
                          {status === 'validated' && (
                            <button
                              type="button"
                              disabled
                              className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-800"
                            >
                              تم التأكيد
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (
                                !window.confirm(
                                  'حذف هذا الطلب نهائياً؟ لا يمكن التراجع.',
                                )
                              )
                                return
                              await removeOrder(o.id)
                              setOrders(await getOrders())
                              setExpandedOrderId((id) =>
                                id === o.id ? null : id,
                              )
                            }}
                            className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
                          >
                            حذف الطلب
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-lg font-extrabold text-gray-900">
            الأكثر مبيعاً اليوم (المتجر)
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            حدّد المنتجات التي تظهر في قسم «الأكثر مبيعاً اليوم». إن لم تُحدّد أي منتج،
            يُعرض <span className="font-bold text-gray-800">كل المنتجات</span> كما
            سابقاً.
          </p>
          <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-gray-800">
                المختار: {featuredIds.length} منتج
              </span>
              {featuredIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFeaturedProductIds([])
                    setFeaturedIds([])
                  }}
                  className="text-sm font-bold text-red-600 hover:underline"
                >
                  مسح الكل
                </button>
              )}
            </div>
            <ul className="max-h-72 space-y-2 overflow-y-auto pe-1 sm:max-h-96">
              {allProducts.map((p) => {
                const thumb = getProductPhotos(p)[0]
                const checked = featuredIds.includes(p.id)
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-white bg-white/90 px-3 py-2 shadow-sm"
                  >
                    <input
                      id={`feat-${p.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={async () => {
                        await toggleFeaturedProductId(p.id)
                        setFeaturedIds(await getFeaturedProductIds())
                      }}
                      className="h-4 w-4 shrink-0 rounded border-gray-300 text-temu focus:ring-temu"
                    />
                    <label
                      htmlFor={`feat-${p.id}`}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-md border border-gray-100 object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400">
                          —
                        </div>
                      )}
                      <span className="min-w-0 truncate text-sm font-semibold text-gray-900">
                        {p.title}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-extrabold text-gray-900">
            تعديل أي منتج (سعر، صور، وصف…)
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            المنتجات الأساسية تُحفظ كتعديل محلي في المتصفح. منتجاتك المضافة تُحدَّث مباشرة في
            التخزين.
          </p>
          <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 sm:max-h-96">
            {allProducts.map((p) => {
              const thumb = getProductPhotos(p)[0]
              const isBase = !String(p.id).startsWith('custom-')
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-md border border-gray-100 object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-200 bg-white text-xs text-gray-400">
                        —
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{p.title}</p>
                      <p className="font-mono text-[10px] text-gray-400">{p.id}</p>
                      {p.productCode ? (
                        <p className="mt-0.5 font-mono text-[10px] text-gray-600">
                          كود المنتج: {p.productCode}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {isBase && (
                      <button
                        type="button"
                        onClick={async () => {
                          await removeProductEdit(p.id)
                        }}
                        className="text-xs font-bold text-gray-500 hover:text-red-600 hover:underline"
                      >
                        استعادة الافتراضي
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `نقل «${p.title}» إلى سلة المحذوفات؟ سيختفي من المتجر.`,
                          )
                        )
                          return
                        if (await softDeleteProduct(p.id)) {
                          setTrashList(getTrash())
                          setFeaturedIds(await getFeaturedProductIds())
                          setExtra(await getExtraProducts())
                          setStoreTick((t) => t + 1)
                          if (editingProductId === p.id) {
                            resetProductForm()
                          }
                          setProductMsg('تم نقل المنتج إلى سلة المحذوفات.')
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-red-600 hover:bg-red-50"
                      title="حذف (سلة المحذوفات)"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      حذف
                    </button>
                    <button
                      type="button"
                      onClick={() => beginEditProduct(p)}
                      className="rounded-full bg-temu px-4 py-1.5 text-xs font-extrabold text-white hover:bg-temu-dark"
                    >
                      تعديل
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-extrabold text-gray-900" id="admin-product-form-title">
            {editingProductId ? 'تعديل المنتج' : 'إضافة منتج'}
          </h2>
          {editingProductId && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <span className="font-bold text-amber-900">
                يتم تعديل:{' '}
                <span className="font-mono text-xs text-amber-800">{editingProductId}</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {!String(editingProductId).startsWith('custom-') && (
                  <button
                    type="button"
                    onClick={async () => {
                      await removeProductEdit(editingProductId)
                      const fresh = (await getMergedProducts()).find((x) => x.id === editingProductId)
                      if (fresh) beginEditProduct(fresh)
                      setProductMsg('تمت استعادة القيم الافتراضية من الملف.')
                      setStoreTick((t) => t + 1)
                    }}
                    className="text-xs font-bold text-amber-800 underline hover:text-amber-950"
                  >
                    استعادة الافتراضي ثم إعادة التحميل
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    resetProductForm()
                    setProductMsg('')
                  }}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  إلغاء التعديل
                </button>
              </div>
            </div>
          )}
          <form
            id="admin-product-form"
            onSubmit={handleAddProduct}
            className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
          >
            <div>
              <label className="mb-1 block text-sm font-bold">عنوان المنتج</label>
              <input
                required
                value={newProduct.title}
                onChange={(e) => setNewProduct((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-temu"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-900">
                كود المنتج
              </label>
              <p className="mb-1.5 text-xs text-gray-500">
                للإدارة فقط — لا يظهر للزوار في المتجر.
              </p>
              <input
                value={newProduct.productCode}
                onChange={(e) =>
                  setNewProduct((p) => ({ ...p, productCode: e.target.value }))
                }
                placeholder="مثال: SKU-1024"
                autoComplete="off"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-temu"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">الوصف</label>
              <textarea
                value={newProduct.description}
                onChange={(e) =>
                  setNewProduct((p) => ({ ...p, description: e.target.value }))
                }
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-temu"
              />
            </div>
            <div>
              <label
                htmlFor="product-category"
                className="mb-1 block text-sm font-bold text-gray-900"
              >
                التصنيف (يظهر في الشريط الجانبي للمتجر)
              </label>
              <select
                id="product-category"
                value={newProduct.categoryId || ''}
                onChange={(e) =>
                  setNewProduct((p) => ({ ...p, categoryId: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-temu"
              >
                <option value="">— بدون تصنيف —</option>
                {shopCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="rounded-xl border border-gray-200 p-4">
              <legend className="px-1 text-sm font-extrabold text-gray-900">
                الصور (حد أقصى {MAX_PHOTOS})
              </legend>
              <p className="mb-3 text-xs text-gray-600">
                ارفع من الجهاز أو ألصق رابطاً. الصور الكبيرة تُضغَّط تلقائياً (حجم رفع حتى ≈{' '}
                {Math.round(MAX_IMAGE_FILE_BYTES / 1048576)} ميجا) للحفظ في المتصفح.
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-full bg-temu px-4 py-2 text-sm font-bold text-white hover:bg-temu-dark">
                  اختيار صور
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={handlePhotoFiles}
                  />
                </label>
                <span className="self-center text-xs text-gray-500">
                  {photoItems.length} / {MAX_PHOTOS}
                </span>
              </div>
              <div className="mb-3 flex gap-2">
                <input
                  type="url"
                  value={photoUrlDraft}
                  onChange={(e) => setPhotoUrlDraft(e.target.value)}
                  placeholder="https://... صورة"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-temu"
                />
                <button
                  type="button"
                  onClick={addPhotoFromUrl}
                  className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold hover:bg-gray-50"
                >
                  إضافة رابط
                </button>
              </div>
              {photoItems.length > 0 && (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {photoItems.map((src, i) => (
                    <li key={`${i}-${src.slice(0, 40)}`} className="relative">
                      <img
                        src={src}
                        alt=""
                        className="aspect-square w-full rounded-lg border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPhotoItems((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="absolute start-1 top-1 rounded bg-red-600 px-1.5 text-xs font-bold text-white"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <fieldset className="rounded-xl border border-gray-200 p-4">
              <legend className="px-1 text-sm font-extrabold text-gray-900">
                الفيديوهات (حد أقصى {MAX_VIDEOS} — اختياري)
              </legend>
              <p className="mb-3 text-xs text-gray-600">
                mp4 / webm من الجهاز، أو رابط يوتيوب. الحد ≈{' '}
                {Math.round(MAX_VIDEO_FILE_BYTES / 1048576)} ميجا لكل ملف.
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-full border-2 border-gray-300 px-4 py-2 text-sm font-bold hover:border-temu">
                  اختيار فيديو
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    className="sr-only"
                    onChange={handleVideoFiles}
                  />
                </label>
                <span className="self-center text-xs text-gray-500">
                  {videoItems.length} / {MAX_VIDEOS}
                </span>
              </div>
              <div className="mb-3 flex gap-2">
                <input
                  type="url"
                  value={videoUrlDraft}
                  onChange={(e) => setVideoUrlDraft(e.target.value)}
                  placeholder="https://youtube.com/... أو رابط mp4"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-temu"
                />
                <button
                  type="button"
                  onClick={addVideoFromUrl}
                  className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold hover:bg-gray-50"
                >
                  إضافة رابط
                </button>
              </div>
              {videoItems.length > 0 && (
                <ul className="space-y-2">
                  {videoItems.map((src, i) => (
                    <li
                      key={`${i}-${src.slice(0, 30)}`}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-xs"
                    >
                      <span className="truncate font-mono">
                        {src.startsWith('data:') ? `فيديو من الجهاز #${i + 1}` : src}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVideoItems((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="shrink-0 font-bold text-red-600"
                      >
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            <fieldset className="rounded-lg border border-gray-200 p-3">
              <legend className="px-1 text-sm font-bold text-gray-900">
                عرض المنتج في المتجر
              </legend>
              <p className="mb-2 text-xs text-gray-600">
                يظهر فقط للزبائن الذين اختاروا بلداً من القائمة. الإمارات بالد.إ،
                باقي الدول بالر.س.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {COUNTRIES.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold"
                  >
                    <input
                      type="checkbox"
                      checked={newProduct.marketCountries.includes(c.id)}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setNewProduct((p) => {
                          const set = new Set(p.marketCountries || [])
                          if (checked) set.add(c.id)
                          else set.delete(c.id)
                          return {
                            ...p,
                            marketCountries: [...set],
                          }
                        })
                      }}
                      className="text-temu focus:ring-temu"
                    />
                    <span aria-hidden>{c.flag}</span>
                    {c.nameAr}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mb-2 text-xs text-gray-600">
              اختر عملة إدخال السعر كما تريد، وسيتم التحويل تلقائياً لباقي العملات
              حسب بلد الزائر.
            </p>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-bold">عملة الإدخال</label>
              <select
                value={newProduct.priceCurrency || 'SAR'}
                onChange={(e) => shiftDraftCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-temu sm:w-auto"
              >
                {availableInputCurrencies.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur} — {CURRENCY_META[cur]?.nameAr || cur}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['priceSar', `السعر الحالي (${currentCurrencySuffix})`],
                ['oldPriceSar', `قبل الخصم (${currentCurrencySuffix})`],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-bold">{label}</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProduct[key]}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, [key]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm outline-none focus:border-temu"
                  />
                </div>
              ))}
            </div>

            <fieldset className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <legend className="px-1 text-sm font-extrabold text-violet-900">
                خصم على الكميات (اختياري — حتى {MAX_QUANTITY_PROMOS} بنود)
              </legend>
              <p className="mb-3 text-xs text-violet-800">
                أدخل الإجمالي بنفس عملة الإدخال (مثال: 2 قطعة بـ 200{' '}
                {currentCurrencySuffix}).
              </p>
              <div className="space-y-2">
                {qtyPromoRows.map((row, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-end gap-2 rounded-lg border border-violet-100 bg-white p-2"
                  >
                    <div className="min-w-[5rem]">
                      <label className="mb-0.5 block text-[10px] font-bold text-gray-600">
                        عدد القطع
                      </label>
                      <input
                        type="number"
                        min={2}
                        step={1}
                        placeholder="2"
                        value={row.quantity}
                        onChange={(e) =>
                          setQtyPromoRows((prev) =>
                            prev.map((r, j) =>
                              j === i ? { ...r, quantity: e.target.value } : r,
                            ),
                          )
                        }
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="min-w-[6rem] flex-1">
                      <label className="mb-0.5 block text-[10px] font-bold text-gray-600">
                        إجمالي ({currentCurrencySuffix})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="200"
                        value={row.priceSar}
                        onChange={(e) =>
                          setQtyPromoRows((prev) =>
                            prev.map((r, j) =>
                              j === i ? { ...r, priceSar: e.target.value } : r,
                            ),
                          )
                        }
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setQtyPromoRows((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={qtyPromoRows.length >= MAX_QUANTITY_PROMOS}
                onClick={() =>
                  setQtyPromoRows((prev) => [
                    ...prev,
                    { quantity: '', priceSar: '' },
                  ])
                }
                className="mt-3 rounded-full border-2 border-violet-400 px-4 py-2 text-sm font-extrabold text-violet-800 disabled:opacity-40"
              >
                + إضافة بند كمية
              </button>
            </fieldset>

            <div>
              <p className="mb-2 text-xs font-bold text-gray-600">
                التقييمات (قيم افتراضية للعرض — غيّرها أو اتركها؛ إن مسحت التقييم
                والعدد معاً يُحفظ تلقائياً بنفس الافتراضي)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold">التقييم (0–5)</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="مثال: 4.7"
                    value={newProduct.rating}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, rating: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm outline-none focus:border-temu"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">عدد الآراء</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="مثال: 370"
                    value={newProduct.reviewCount}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, reviewCount: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm outline-none focus:border-temu"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">المبيعات (اختياري)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="مثال: 3400"
                    value={newProduct.soldCount}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, soldCount: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm outline-none focus:border-temu"
                  />
                </div>
              </div>
            </div>
            {productMsg && (
              <p
                className={`text-sm font-semibold ${productMsg.includes('تم') ? 'text-green-700' : 'text-red-600'}`}
              >
                {productMsg}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-temu px-8 py-3 font-extrabold text-white hover:bg-temu-dark"
              >
                {editingProductId ? 'حفظ التعديلات' : 'حفظ المنتج'}
              </button>
              {editingProductId && (
                <button
                  type="button"
                  onClick={() => {
                    resetProductForm()
                    setProductMsg('')
                  }}
                  className="rounded-full border border-gray-300 bg-white px-6 py-3 font-bold text-gray-700 hover:bg-gray-50"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-extrabold text-gray-900">
            منتجاتك المضافة ({extra.length})
          </h2>
          {extra.length === 0 ? (
            <p className="text-sm text-gray-500">لم تضف منتجات بعد.</p>
          ) : (
            <ul className="space-y-2">
              {extra.map((p) => {
                const thumb = getProductPhotos(p)[0]
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-100 text-xs text-gray-400"
                        aria-hidden
                      >
                        —
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">{p.title}</span>
                      {p.productCode ? (
                        <span className="mt-0.5 block font-mono text-[11px] text-gray-600">
                          كود المنتج: {p.productCode}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs font-bold text-gray-500">
                        {formatMarketsLabel(p)} — {mediaSummaryText(p)}
                      </span>
                      <p className="mt-1.5 break-all font-mono text-[10px] leading-tight text-gray-400">
                        رابط الإعلان:{' '}
                        {typeof window !== 'undefined'
                          ? `${window.location.origin}${productLandingPath(p.id)}`
                          : productLandingPath(p.id)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `نقل «${p.title}» إلى سلة المحذوفات؟`,
                          )
                        )
                          return
                        if (await softDeleteProduct(p.id)) {
                          setTrashList(getTrash())
                          setFeaturedIds(await getFeaturedProductIds())
                          setExtra(await getExtraProducts())
                          setStoreTick((t) => t + 1)
                          if (editingProductId === p.id) resetProductForm()
                          setProductMsg('تم نقل المنتج إلى سلة المحذوفات.')
                        }
                      }}
                      className="inline-flex items-center gap-1 text-sm font-bold text-red-600 hover:underline"
                    >
                      <TrashIcon className="h-4 w-4" />
                      حذف
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
