import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CheckoutModal from '../components/CheckoutModal.jsx'
import CountryDropdown from '../components/CountryDropdown.jsx'
import CountryPromptModal from '../components/CountryPromptModal.jsx'
import ProductGalleryModal from '../components/ProductGalleryModal.jsx'
import QuantityPromoBadges from '../components/QuantityPromoBadges.jsx'
import { formatMoney } from '../lib/money.js'
import { getProductPricesForCountry } from '../lib/pricing.js'
import { getProductPhotos } from '../lib/productMedia.js'
import { computeOrderLinePrice } from '../lib/quantityPromos.js'
import {
  addOrder,
  getMergedProducts,
  notifyStoreUpdate,
  productAvailableInCountry,
} from '../lib/store.js'
import {
  currencyForCountry,
  defaultPhonePrefixForCountry,
  getStoredCountry,
  isValidFullPhone,
  nationalPhoneDigitsForPrefix,
} from '../lib/countries.js'
import { trackCheckoutLead, trackProductView } from '../tracking.js'
const WHATSAPP_LINK = 'https://wa.me/966500000000'

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

function formatSoldCompact(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M+`
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K+`
  return `${n}+`
}

function setMetaTag(attr, key, content) {
  if (!content) return
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export default function ProductLanding() {
  const { productId } = useParams()
  const [productsList, setProductsList] = useState(() => getMergedProducts())

  useEffect(() => {
    const sync = () => setProductsList(getMergedProducts())
    window.addEventListener('taager-store-update', sync)
    return () => window.removeEventListener('taager-store-update', sync)
  }, [])

  const product = useMemo(() => {
    const decoded = productId ? decodeURIComponent(productId) : ''
    return productsList.find((p) => p.id === decoded) ?? null
  }, [productsList, productId])

  const [country, setCountry] = useState(() => getStoredCountry())
  const currency = useMemo(
    () => (country ? currencyForCountry(country) : 'SAR'),
    [country],
  )
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
      product &&
      galleryProduct.id === product.id &&
      country &&
      !productAvailableInCountry(product, country)
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
  }, [country, currency, galleryProduct, checkoutOpen, selectedProduct, product])

  useEffect(() => {
    if (!product) {
      document.title = 'منتج غير موجود | تاجرستور'
      return
    }
    const title = `${product.title} | تاجرستور`
    document.title = title
    const desc =
      typeof product.description === 'string'
        ? product.description.replace(/\s+/g, ' ').trim().slice(0, 160)
        : ''
    setMetaTag('name', 'description', desc)
    setMetaTag('property', 'og:title', title)
    setMetaTag('property', 'og:description', desc)
    const img = getProductPhotos(product)[0]
    if (img) setMetaTag('property', 'og:image', img)
    setMetaTag('property', 'og:type', 'product')
  }, [product])

  useEffect(() => {
    if (product) {
      trackProductView(product, currency === 'SAR' ? 'SAR' : 'AED')
    }
  }, [product, currency])

  const openCheckout = useCallback(
    (p) => {
      setSelectedProduct(p)
      setOrderQty(1)
      setFormError('')
      setCheckoutOpen(true)
      trackProductView(p, currency === 'SAR' ? 'SAR' : 'AED')
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

  const submitCod = (e) => {
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
        source: 'landing',
      },
      selectedProduct,
    )
    addOrder({
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
      source: 'landing',
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

  if (!productId) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-16 text-center" dir="rtl">
        <p className="text-gray-600">رابط غير صالح.</p>
        <Link to="/" className="mt-4 inline-block font-bold text-temu underline">
          العودة للمتجر
        </Link>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-16 text-center" dir="rtl">
        <h1 className="text-xl font-extrabold text-gray-900">المنتج غير متوفر</h1>
        <p className="mt-2 text-gray-600">قد يكون الرابط قديماً أو المنتج أزيل.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-full bg-temu px-6 py-3 font-extrabold text-white"
        >
          تصفح المتجر
        </Link>
      </div>
    )
  }

  if (!country) {
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <CountryPromptModal open onSelected={setCountry} />
        <div className="px-4 py-16 text-center">
          <h1 className="text-lg font-extrabold text-gray-900">{product.title}</h1>
          <p className="mt-4 text-gray-600">اختر بلدك لعرض السعر والتوفر</p>
          <Link
            to="/"
            className="mt-8 inline-block font-bold text-temu underline"
          >
            ← العودة للمتجر
          </Link>
        </div>
      </div>
    )
  }

  if (!productAvailableInCountry(product, country)) {
    return (
      <div className="min-h-screen bg-gray-50 pb-28" dir="rtl">
        <header className="border-b border-orange-100 bg-white px-3 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <Link to="/" className="font-extrabold text-temu">
              ← المتجر
            </Link>
            <div className="min-w-0 max-w-[14rem] shrink">
              <CountryDropdown
                countryId={country}
                onCountryChange={setCountry}
              />
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-xl font-extrabold text-gray-900">{product.title}</h1>
          <p className="mt-4 text-lg font-semibold text-gray-800">
            هذا المنتج غير متوفر في بلدك
          </p>
          <p className="mt-2 text-sm text-gray-600">
            جرّب تغيير البلد من القائمة أعلاه أو ارجع للمتجر.
          </p>
          <Link
            to="/"
            className="mt-8 inline-block rounded-full bg-temu px-6 py-3 font-extrabold text-white"
          >
            تصفح المنتجات المتوفرة
          </Link>
        </div>
      </div>
    )
  }

  const photos = getProductPhotos(product)
  const coverSrc = photos[0] || ''
  const { unit: price, old, currency: displayCur } = getProductPricesForCountry(
    product,
    country,
  )
  const off =
    old > 0 ? Math.round(((old - price) / old) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 pb-28" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-orange-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-3 py-3">
          <Link to="/" className="text-lg font-extrabold text-temu sm:text-xl">
            ← المتجر
          </Link>
          <div className="min-w-0 max-w-[14rem] shrink">
            <CountryDropdown countryId={country} onCountryChange={setCountry} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 pt-4">
        <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
          <button
            type="button"
            className="group/img relative aspect-square w-full cursor-zoom-in overflow-hidden border-0 bg-gray-100 p-0"
            onClick={() => setGalleryProduct(product)}
            aria-label={`معرض صور: ${product.title}`}
          >
            <img
              src={coverSrc}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-105"
            />
            <span className="absolute start-3 top-3 rounded-md bg-temu px-2 py-0.5 text-xs font-extrabold text-white shadow">
              -{off}%
            </span>
            <span className="pointer-events-none absolute bottom-3 end-3 rounded bg-black/55 px-2 py-0.5 text-xs font-bold text-white">
              معرض الصور
            </span>
          </button>
          <div className="p-4 sm:p-6">
            <h1 className="text-xl font-extrabold leading-snug text-gray-900 sm:text-2xl">
              {product.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
              {product.description}
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-black text-temu sm:text-3xl">
                {formatMoney(price, displayCur)}
              </span>
              <span className="text-lg text-gray-400 line-through">
                {formatMoney(old, displayCur)}
              </span>
            </div>
            <QuantityPromoBadges product={product} country={country} />
            {hasReviewRow(product) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-gray-600">
                <StarRow rating={product.rating} />
                <span className="font-semibold tabular-nums text-gray-800">
                  {product.rating.toFixed(1)}
                </span>
                <span className="text-gray-400">
                  ({product.reviewCount.toLocaleString('ar-SA')})
                </span>
                {typeof product.soldCount === 'number' &&
                  Number.isFinite(product.soldCount) &&
                  product.soldCount > 0 && (
                    <>
                      <span className="text-gray-300" aria-hidden>
                        ·
                      </span>
                      <span className="text-gray-500">
                        {formatSoldCompact(product.soldCount)} مبيع
                      </span>
                    </>
                  )}
              </div>
            )}
            <button
              type="button"
              onClick={() => openCheckout(product)}
              className="mt-6 w-full rounded-full bg-temu py-3.5 text-base font-extrabold text-white shadow-urgent transition hover:bg-temu-dark active:scale-[0.99] sm:text-lg"
            >
              اشترِ الآن — الدفع عند الاستلام
            </button>
            <p className="mt-4 text-center text-xs text-gray-400">
              رابط هذه الصفحة مناسب لإعلانات فيسبوك، جوجل، تيك توك…
            </p>
          </div>
        </article>

        <p className="mt-8 pb-8 text-center">
          <Link
            to="/"
            className="text-sm font-bold text-temu underline-offset-2 hover:underline"
          >
            ← العودة لجميع المنتجات
          </Link>
        </p>
      </main>

      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-2xl text-white shadow-lg transition hover:scale-105 sm:h-16 sm:w-16"
        aria-label="واتساب"
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

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
