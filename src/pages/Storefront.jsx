import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CheckoutModal from '../components/CheckoutModal.jsx'
import CountryDropdown from '../components/CountryDropdown.jsx'
import CountryPromptModal from '../components/CountryPromptModal.jsx'
import HeaderBannerCarousel from '../components/HeaderBannerCarousel.jsx'
import ProductGalleryModal from '../components/ProductGalleryModal.jsx'
import QuantityPromoBadges from '../components/QuantityPromoBadges.jsx'
import { getProductPhotos } from '../lib/productMedia.js'
import { formatMoney } from '../lib/money.js'
import { getProductPricesForCountry } from '../lib/pricing.js'
import { productLandingPath } from '../lib/productUrl.js'
import { computeOrderLinePrice } from '../lib/quantityPromos.js'
import {
  addOrder,
  DEFAULT_CATEGORIES,
  DEFAULT_HEADER_BANNERS,
  getBaseProductsSync,
  getCategories,
  getFeaturedProductIds,
  getHeaderBanners,
  getMergedProducts,
  notifyStoreUpdate,
  productAvailableInCountry,
} from '../lib/store.js'
import { trackCheckoutLead, trackProductView } from '../tracking.js'
import {
  COUNTRY_BY_ID,
  currencyForCountry,
  defaultPhonePrefixForCountry,
  getStoredCountry,
  isValidFullPhone,
  nationalPhoneDigitsForPrefix,
} from '../lib/countries.js'

const FLASH_KEY = 'flashSaleEndsAt'

function getFlashEndTime() {
  try {
    const saved = localStorage.getItem(FLASH_KEY)
    if (saved) {
      const n = parseInt(saved, 10)
      if (!Number.isNaN(n) && n > Date.now()) return n
    }
    const end = Date.now() + 24 * 60 * 60 * 1000
    localStorage.setItem(FLASH_KEY, String(end))
    return end
  } catch {
    return Date.now() + 24 * 60 * 60 * 1000
  }
}

function useCountdown(targetMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, targetMs - now)
  const h = Math.floor(left / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return { h, m, s, totalMs: left }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatSoldCompact(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M+`
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K+`
  return `${n}+`
}

function hasReviewRow(p) {
  return (
    typeof p.rating === 'number' &&
    !Number.isNaN(p.rating) &&
    typeof p.reviewCount === 'number' &&
    Number.isFinite(p.reviewCount) &&
    p.reviewCount >= 0
  )
}

function StarRow({ rating }) {
  const r = Math.min(5, Math.max(0, rating))
  return (
    <span className="inline-flex items-center gap-px" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-[11px] leading-none sm:text-xs ${r >= i ? 'text-amber-500' : 'text-gray-200'}`}
        >
          ★
        </span>
      ))}
    </span>
  )
}

function GridFourIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
    </svg>
  )
}

function ChevronStartIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
    </svg>
  )
}

function ProductTile({ p, country, onOpenGallery, onCheckout }) {
  const photos = getProductPhotos(p)
  const coverSrc = photos[0] || ''
  const { unit: price, old, currency } = getProductPricesForCountry(p, country)
  const off =
    old > 0 && price >= 0 ? Math.round(((old - price) / old) * 100) : 0
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        className="group/img relative aspect-[4/3] w-full max-h-[140px] cursor-zoom-in overflow-hidden border-0 bg-gray-50 p-0 text-start sm:max-h-[160px] lg:max-h-[148px]"
        onClick={() => onOpenGallery(p)}
        aria-label={`عرض تفاصيل وصور: ${p.title}`}
      >
        <img
          src={coverSrc}
          alt=""
          className="h-full w-full object-contain object-center transition-transform duration-300 ease-out group-hover/img:scale-[1.03]"
          loading="lazy"
        />
        <span className="absolute start-1 top-1 z-10 rounded bg-temu px-1 py-px text-[8px] font-extrabold leading-none text-white shadow sm:start-1.5 sm:top-1.5 sm:px-1 sm:py-0.5 sm:text-[9px]">
          -{off}%
        </span>
        <span className="pointer-events-none absolute bottom-1 end-1 z-10 rounded bg-black/50 px-1 py-px text-[8px] font-bold leading-none text-white sm:bottom-1.5 sm:end-1.5 sm:px-1.5 sm:py-0.5 sm:text-[9px]">
          معرض
        </span>
      </button>
      <div className="flex flex-1 flex-col p-2 sm:p-2.5">
        <h3 className="line-clamp-2 text-xs font-bold leading-snug text-gray-900 sm:text-sm">
          <Link
            to={productLandingPath(p.id, country)}
            className="hover:text-temu hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {p.title}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-2 flex-1 text-[11px] text-gray-500 sm:mt-1 sm:text-xs">
          {p.description}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
          <span className="text-sm font-black text-temu sm:text-base">
            {formatMoney(price, currency)}
          </span>
          <span className="text-xs text-gray-400 line-through sm:text-sm">
            {formatMoney(old, currency)}
          </span>
        </div>
        <QuantityPromoBadges product={p} country={country} compact />
        {hasReviewRow(p) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] text-gray-600 sm:text-[11px]">
            <StarRow rating={p.rating} />
            <span className="font-semibold tabular-nums text-gray-800">
              {p.rating.toFixed(1)}
            </span>
            <span className="text-gray-400">
              ({p.reviewCount.toLocaleString('ar-SA')})
            </span>
            {typeof p.soldCount === 'number' &&
              Number.isFinite(p.soldCount) &&
              p.soldCount > 0 && (
                <>
                  <span className="text-gray-300" aria-hidden>
                    ·
                  </span>
                  <span className="text-gray-500">
                    {formatSoldCompact(p.soldCount)} مبيع
                  </span>
                </>
              )}
          </div>
        )}
        <button
          type="button"
          onClick={() => onCheckout(p)}
          className="mt-2 w-full rounded-full bg-temu py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-temu-dark active:scale-[0.98] sm:mt-2.5 sm:py-2.5 sm:text-sm"
        >
          اشترِ الآن
        </button>
      </div>
    </li>
  )
}

export default function Storefront() {
  const [productsList, setProductsList] = useState(() => getBaseProductsSync())
  const [featuredIds, setFeaturedIds] = useState([])
  const [headerBanners, setHeaderBanners] = useState(DEFAULT_HEADER_BANNERS)
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [categoriesMenuOpen, setCategoriesMenuOpen] = useState(false)

  useEffect(() => {
    Promise.all([getMergedProducts(), getFeaturedProductIds(), getHeaderBanners(), getCategories()])
      .then(([products, featured, banners, cats]) => {
        setProductsList(products)
        setFeaturedIds(featured)
        setHeaderBanners(banners)
        setCategories(cats)
      })
  }, [])

  useEffect(() => {
    const sync = async () => {
      const [products, featured, banners, cats] = await Promise.all([
        getMergedProducts(), getFeaturedProductIds(), getHeaderBanners(), getCategories()
      ])
      setProductsList(products)
      setFeaturedIds(featured)
      setHeaderBanners(banners)
      setCategories(cats)
    }
    window.addEventListener('taager-store-update', sync)
    return () => window.removeEventListener('taager-store-update', sync)
  }, [])

  const [country, setCountry] = useState(() => getStoredCountry())
  const currency = useMemo(
    () => (country ? currencyForCountry(country) : 'SAR'),
    [country],
  )
  const [search, setSearch] = useState('')
  const [flashEnd] = useState(() => getFlashEndTime())
  const { h, m, s } = useCountdown(flashEnd)

  const [galleryProduct, setGalleryProduct] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [orderQty, setOrderQty] = useState(1)
  const [form, setForm] = useState({
    name: '',
    phonePrefix: '+966',
    phoneRest: '',
    city: '',
  })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!country) return
    const phonePrefix = defaultPhonePrefixForCountry(country)
    const max = nationalPhoneDigitsForPrefix(phonePrefix)
    setForm((f) => ({
      ...f,
      phonePrefix,
      phoneRest: f.phoneRest.replace(/\D/g, '').slice(0, max),
    }))
  }, [country])

  useEffect(() => {
    const onCountry = () => {
      const c = getStoredCountry()
      if (c) setCountry(c)
    }
    window.addEventListener('taager-country-change', onCountry)
    return () => window.removeEventListener('taager-country-change', onCountry)
  }, [])

  useEffect(() => {
    if (
      galleryProduct &&
      country &&
      !productAvailableInCountry(galleryProduct, country)
    ) {
      setGalleryProduct(null)
    }
    if (
      checkoutOpen &&
      selectedProduct &&
      country &&
      !productAvailableInCountry(selectedProduct, country)
    ) {
      setCheckoutOpen(false)
      setSelectedProduct(null)
    }
  }, [country, galleryProduct, checkoutOpen, selectedProduct])

  const filtered = useMemo(() => {
    if (!country) return []
    let list = productsList.filter((p) => productAvailableInCountry(p, country))
    if (selectedCategoryId) {
      list = list.filter(
        (p) => String(p.categoryId || '') === String(selectedCategoryId),
      )
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      )
    }
    return list
  }, [search, productsList, country, selectedCategoryId])

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId],
  )

  const selectCategory = useCallback((id) => {
    setSelectedCategoryId(id)
    setCategoriesMenuOpen(false)
  }, [])

  /** الأكثر مبيعاً: ترتيب الإدارة. باقي المنتجات: كل ما عدا المختارين (إلا ما كانش مختار → الكل تحت) */
  const featuredProducts = useMemo(() => {
    if (!featuredIds.length) return []
    const byId = new Map(filtered.map((p) => [p.id, p]))
    const ordered = []
    for (const id of featuredIds) {
      const p = byId.get(id)
      if (p) ordered.push(p)
    }
    return ordered
  }, [filtered, featuredIds])

  const restProducts = useMemo(() => {
    if (!featuredIds.length) return filtered
    const feat = new Set(featuredIds)
    return filtered.filter((p) => !feat.has(p.id))
  }, [filtered, featuredIds])

  const openCheckout = useCallback(
    (product) => {
      setSelectedProduct(product)
      setOrderQty(1)
      setFormError('')
      setCheckoutOpen(true)
      trackProductView(product, currency === 'SAR' ? 'SAR' : 'AED')
    },
    [currency],
  )

  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false)
    setSelectedProduct(null)
    setOrderQty(1)
    setFormError('')
  }, [])

  const orderLine = useMemo(() => {
    if (!selectedProduct) return null
    return computeOrderLinePrice(selectedProduct, currency, orderQty)
  }, [selectedProduct, currency, orderQty])

  const fullPhone = `${form.phonePrefix}${form.phoneRest.replace(/\D/g, '')}`

  const submitCod = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) {
      setFormError('الرجاء إدخال الاسم')
      return
    }
    if (!isValidFullPhone(fullPhone)) {
      setFormError(
        'رقم الجوال غير صالح — طابق رمز الدولة مع عدد الأرقام (مثلاً مصر +20 بعشرة أرقام، عُمان +968 بثمانية)',
      )
      return
    }
    if (!form.city.trim()) {
      setFormError('الرجاء إدخال المدينة')
      return
    }
    if (!selectedProduct) {
      setFormError('لا يوجد منتج')
      return
    }
    const line = computeOrderLinePrice(selectedProduct, currency, orderQty)
    trackCheckoutLead(
      {
        name: form.name.trim(),
        phone: fullPhone,
        city: form.city.trim(),
        currency,
        quantity: line.quantity,
        lineTotalSar: line.lineTotalSar,
        lineTotalAed: line.lineTotalAed,
      },
      selectedProduct,
    )
    await addOrder({
      name: form.name.trim(),
      phone: fullPhone,
      city: form.city.trim(),
      currency,
      productId: selectedProduct.id,
      productTitle: selectedProduct.title,
      quantity: line.quantity,
      unitPriceSar: line.unitPriceSar,
      unitPriceAed: line.unitPriceAed,
      lineTotalSar: line.lineTotalSar,
      lineTotalAed: line.lineTotalAed,
      priceSar: line.lineTotalSar,
      priceAed: line.lineTotalAed,
    })
    notifyStoreUpdate()
    alert('تم استلام طلبك! سنتواصل معك لتأكيد الطلب والدفع عند الاستلام.')
    closeCheckout()
    setForm({
      name: '',
      phonePrefix: country ? defaultPhonePrefixForCountry(country) : '+966',
      phoneRest: '',
      city: '',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="fixed inset-x-0 top-0 z-50 shadow-md">
        <div className="bg-temu px-3 py-2 text-center text-sm font-bold text-white sm:text-base">
          <span className="inline-flex animate-pulse items-center gap-2">
            <span aria-hidden>🔥</span>
            توصيل مجاني للطلبات اليوم — عروض محدودة!
            <span aria-hidden>🔥</span>
          </span>
        </div>
        <header className="border-b border-orange-100 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-temu sm:text-2xl">
                  OurShoping
                </span>
              </div>
              {country && (
                <div className="sm:hidden">
                  <CountryDropdown
                    countryId={country}
                    onCountryChange={setCountry}
                  />
                </div>
              )}
            </div>
            <div className="relative flex-1 sm:max-w-xl">
              <label htmlFor="search" className="sr-only">
                بحث عن منتجات
              </label>
              <input
                id="search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن سماعات، ساعات، أدوات مطبخ..."
                className="w-full rounded-full border-2 border-orange-100 bg-gray-50 py-2.5 pe-4 ps-10 text-sm outline-none transition focus:border-temu focus:bg-white sm:py-3 sm:text-base"
              />
              <span
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400"
                aria-hidden
              >
                ⌕
              </span>
            </div>
            {country && (
              <div className="hidden shrink-0 sm:block sm:min-w-[14rem]">
                <CountryDropdown
                  countryId={country}
                  onCountryChange={setCountry}
                />
              </div>
            )}
          </div>
        </header>

        <div className="relative overflow-visible border-t border-gray-100 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
            <div className="relative">
              {categoriesMenuOpen && (
                <button
                  type="button"
                  className="fixed inset-0 z-[55] cursor-default bg-black/30"
                  aria-label="إغلاق القائمة"
                  onClick={() => setCategoriesMenuOpen(false)}
                />
              )}
              <button
                type="button"
                onClick={() => setCategoriesMenuOpen((v) => !v)}
                className="relative z-[70] inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-teal-700 active:scale-[0.98] sm:px-4"
                aria-expanded={categoriesMenuOpen}
                aria-haspopup="menu"
              >
                <GridFourIcon className="h-5 w-5 shrink-0 opacity-95" />
                جميع الفئات
              </button>
              {categoriesMenuOpen && (
                  <div
                    className="absolute start-0 top-full z-[70] mt-1 max-h-[min(70vh,28rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 shadow-2xl"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => selectCategory(null)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm font-bold transition hover:bg-gray-50 ${
                        selectedCategoryId == null
                          ? 'bg-teal-50 text-teal-900'
                          : 'text-gray-900'
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                        <GridFourIcon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-start">
                        الكل
                      </span>
                      <ChevronStartIcon className="h-4 w-4 shrink-0 text-gray-400" />
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="menuitem"
                        onClick={() => selectCategory(c.id)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm font-bold transition hover:bg-gray-50 ${
                          selectedCategoryId === c.id
                            ? 'bg-teal-50 text-teal-900'
                            : 'text-gray-900'
                        }`}
                      >
                        {c.imageUrl ? (
                          <img
                            src={c.imageUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
                            —
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-start">
                          {c.nameAr}
                        </span>
                        <ChevronStartIcon className="h-4 w-4 shrink-0 text-gray-400" />
                      </button>
                    ))}
                  </div>
              )}
            </div>
            {selectedCategory && (
              <span className="min-w-0 max-w-[55%] truncate text-xs font-semibold text-gray-600 sm:max-w-none sm:text-sm">
                {selectedCategory.nameAr}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="h-[180px] sm:h-[168px]" aria-hidden />

      <main className="mx-auto max-w-6xl px-3">
        <HeaderBannerCarousel urls={headerBanners}>
          <p className="mb-1 text-sm font-semibold text-orange-100 sm:text-base">
            تخفيضات فلاش — تنتهي خلال:
          </p>
          <h1 className="mb-4 text-2xl font-extrabold leading-tight sm:text-4xl">
            أقل الأسعار في الخليج
            <br />
            <span className="text-yellow-200">شحن سريع — دفع عند الاستلام</span>
          </h1>
          <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold sm:text-sm">
            <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              وفر حتى 70٪
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              موردون موثوقون
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              مناسب لبائعي تاجر
            </span>
          </div>
          <div
            className="flex gap-2 sm:gap-3"
            role="timer"
            aria-live="polite"
            aria-atomic="true"
          >
            {[
              { label: 'ساعة', value: h },
              { label: 'دقيقة', value: m },
              { label: 'ثانية', value: s },
            ].map((u) => (
              <div
                key={u.label}
                className="flex min-w-[4.5rem] flex-col items-center rounded-xl bg-black/25 px-3 py-2 backdrop-blur sm:min-w-[5.5rem] sm:px-4 sm:py-3"
              >
                <span className="text-2xl font-black tabular-nums sm:text-4xl">
                  {pad2(u.value)}
                </span>
                <span className="text-[10px] font-semibold text-orange-100 sm:text-xs">
                  {u.label}
                </span>
              </div>
            ))}
          </div>
        </HeaderBannerCarousel>

        <div className="mt-4 space-y-10 sm:mt-6">
          {selectedCategory && (
            <p className="text-sm text-gray-600">عرض: {selectedCategory.nameAr}</p>
          )}

          {featuredProducts.length > 0 && (
            <section aria-labelledby="featured-heading">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
                <h2
                  id="featured-heading"
                  className="text-xl font-extrabold text-gray-900 sm:text-2xl"
                >
                  الأكثر مبيعاً اليوم
                </h2>
                <span className="whitespace-nowrap rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-temu-dark">
                  {featuredProducts.length} منتج
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
                {featuredProducts.map((p) => (
                  <ProductTile
                    key={p.id}
                    p={p}
                    country={country}
                    onOpenGallery={setGalleryProduct}
                    onCheckout={openCheckout}
                  />
                ))}
              </ul>
            </section>
          )}

          {restProducts.length > 0 && (
            <section aria-labelledby="all-products-heading" id="tous-les-produits">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
                <h2
                  id="all-products-heading"
                  className="text-xl font-extrabold text-gray-900 sm:text-2xl"
                >
                  جميع المنتجات
                </h2>
                <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">
                  {restProducts.length} منتج
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
                {restProducts.map((p) => (
                  <ProductTile
                    key={p.id}
                    p={p}
                    country={country}
                    onOpenGallery={setGalleryProduct}
                    onCheckout={openCheckout}
                  />
                ))}
              </ul>
            </section>
          )}

          {country && filtered.length === 0 && (
            <div className="space-y-2 py-12 text-center text-gray-600">
              {productsList.length === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-temu" />
                  <p className="text-sm font-bold text-gray-500">جاري تحميل المنتجات…</p>
                </div>
              ) : productsList.length > 0 &&
              !search.trim() &&
              !selectedCategoryId &&
              productsList.some((p) => productAvailableInCountry(p, country)) ===
                false ? (
                <>
                  <p className="font-bold text-gray-800">
                    لا توجد منتجات متوفرة للشحن إلى{' '}
                    {COUNTRY_BY_ID[country]?.nameAr ?? country}.
                  </p>
                  <p className="text-sm">
                    جرّب اختيار بلداً آخر من القائمة أعلاه، أو من الإدارة أضف هذا
                    البلد ضمن «أسواق العرض» للمنتجات التي تريد بيعها هناك.
                  </p>
                </>
              ) : (
                <p>لا توجد نتائج مطابقة.</p>
              )}
            </div>
          )}
        </div>

      </main>

      <CountryPromptModal open={!country} onSelected={setCountry} />

      <ProductGalleryModal
        product={galleryProduct}
        open={galleryProduct != null}
        onClose={() => setGalleryProduct(null)}
        onBuyNow={openCheckout}
        formatMoney={formatMoney}
        country={country}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={closeCheckout}
        selectedProduct={selectedProduct}
        orderLine={orderLine}
        orderQty={orderQty}
        setOrderQty={setOrderQty}
        currency={currency}
        form={form}
        setForm={setForm}
        formError={formError}
        onSubmit={submitCod}
      />
    </div>
  )
}
