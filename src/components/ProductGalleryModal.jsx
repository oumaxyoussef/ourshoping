import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QuantityPromoBadges from './QuantityPromoBadges.jsx'
import { getProductPhotos, getProductVideos } from '../lib/productMedia.js'
import { getProductPricesForCountry } from '../lib/pricing.js'
import { isProductPicked, toggleProductPick } from '../lib/picks.js'

function hiResUrl(url) {
  if (!url || String(url).startsWith('data:')) return url
  try {
    const u = new URL(url)
    if (u.hostname.includes('unsplash.com')) {
      u.searchParams.set('w', '1600')
      u.searchParams.set('q', '85')
    }
    return u.toString()
  } catch {
    return url
  }
}

function youtubeEmbed(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url.trim())
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
      const m = u.pathname.match(/\/embed\/([^/?]+)/)
      if (m) return `https://www.youtube.com/embed/${m[1]}`
    }
  } catch {
    return null
  }
  return null
}

function isDirectVideoUrl(url) {
  const s = String(url).trim()
  if (s.startsWith('data:video/')) return true
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(s)
}

/** توزيع تقريبي للعرض (لا يعكس آراء حقيقية). */
function syntheticStarPercents(rating) {
  const r = Math.min(5, Math.max(0, Number(rating) || 4.5))
  const levels = [5, 4, 3, 2, 1]
  const w = levels.map((s) => Math.max(0.06, Math.exp(-((s - r) ** 2) / 1.2)))
  const t = w.reduce((a, b) => a + b, 0)
  return levels.map((s, i) => ({ star: s, percent: (w[i] / t) * 100 }))
}

function formatSoldCompact(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M+`
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K+`
  return `${n}+`
}

function StarRowSmall({ rating }) {
  const r = Math.min(5, Math.max(0, rating))
  return (
    <span className="inline-flex items-center gap-px" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-sm ${r >= i ? 'text-amber-500' : 'text-gray-200'}`}
        >
          ★
        </span>
      ))}
    </span>
  )
}

function CustomerReviewsPanel({ product }) {
  const rating = product.rating
  const total = product.reviewCount
  if (typeof rating !== 'number' || typeof total !== 'number') return null

  const rows = syntheticStarPercents(rating)

  return (
    <section
      className="mt-4 border-t border-gray-100 pt-4"
      aria-labelledby="modal-reviews-heading"
    >
      <h3 id="modal-reviews-heading" className="text-sm font-extrabold text-gray-900">
        آراء العملاء ({total.toLocaleString('ar-SA')})
      </h3>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center rounded-xl bg-gray-50 px-6 py-4 sm:items-center">
          <span className="text-4xl font-black tabular-nums text-gray-900">
            {rating.toFixed(1)}
          </span>
          <StarRowSmall rating={rating} />
          <span className="mt-1 text-xs text-gray-500">من 5</span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {rows.map(({ star, percent }) => (
            <div key={star} className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="w-14 shrink-0 font-semibold text-gray-600">
                {star} ★
              </span>
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gray-900 transition-[width] duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-11 shrink-0 text-end tabular-nums text-gray-500">
                {Math.round(percent)}٪
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const ZOOM_SCALE = 2.25

/** مستطيل الرسم الفعلي لـ object-fit: contain داخل صندوق الـ img */
function getObjectFitContainLocal(img) {
  const r = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh || r.width < 1 || r.height < 1) {
    return {
      offX: 0,
      offY: 0,
      drawW: r.width,
      drawH: r.height,
      boxW: r.width,
      boxH: r.height,
    }
  }
  const ir = nw / nh
  const cr = r.width / r.height
  let drawW
  let drawH
  let offX
  let offY
  if (ir > cr) {
    drawW = r.width
    drawH = r.width / ir
    offX = 0
    offY = (r.height - drawH) / 2
  } else {
    drawH = r.height
    drawW = r.height * ir
    offX = (r.width - drawW) / 2
    offY = 0
  }
  return { offX, offY, drawW, drawH, boxW: r.width, boxH: r.height }
}

function ZoomableImage({ src }) {
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const [hover, setHover] = useState(false)
  const [mobileZoom, setMobileZoom] = useState(false)
  const [tapZoom, setTapZoom] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    setTapZoom(window.matchMedia('(hover: none)').matches)
  }, [])

  /** أصل التكبير كنسبة من صندوق الـ img، مع اقتصار على منطقة الصورة الحقيقية (ليس الهوامش الرمادية) */
  const onMove = useCallback((e) => {
    const el = imgRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const { offX, offY, drawW, drawH, boxW, boxH } = getObjectFitContainLocal(el)
    const lx = e.clientX - r.left
    const ly = e.clientY - r.top
    const bx = Math.min(offX + drawW, Math.max(offX, lx))
    const by = Math.min(offY + drawH, Math.max(offY, ly))
    setOrigin({
      x: (bx / boxW) * 100,
      y: (by / boxH) * 100,
    })
  }, [])

  const zoomed = hover || (tapZoom && mobileZoom)
  const hi = hiResUrl(src)

  return (
    <div className="relative w-full">
      <div
        className="relative flex w-full cursor-crosshair items-center justify-center overflow-hidden rounded-xl bg-gray-100 touch-manipulation"
        style={{
          minHeight: 'min(280px, 55vh)',
          maxHeight: 'min(70vh, 600px)',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false)
          setOrigin({ x: 50, y: 50 })
        }}
        onMouseMove={onMove}
        onClick={() => tapZoom && setMobileZoom((z) => !z)}
        role="presentation"
      >
        <img
          ref={imgRef}
          src={hi}
          alt=""
          className="h-auto max-h-[min(70vh,600px)] w-full object-contain transition-transform duration-100 ease-out select-none"
          style={{
            transform: zoomed ? `scale(${ZOOM_SCALE})` : 'scale(1)',
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget
            const { offX, offY, drawW, drawH, boxW, boxH } =
              getObjectFitContainLocal(img)
            setOrigin({
              x: ((offX + drawW / 2) / boxW) * 100,
              y: ((offY + drawH / 2) / boxH) * 100,
            })
          }}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-500 sm:text-xs">
        <span className="hidden sm:inline">مرّر المؤشر على الصورة للتكبير</span>
        <span className="sm:hidden">اضغط على الصورة لتكبير/تصغير</span>
      </p>
    </div>
  )
}

export default function ProductGalleryModal({
  product,
  open,
  onClose,
  onBuyNow,
  formatMoney,
  country,
}) {
  const imageUrls = useMemo(() => getProductPhotos(product), [product])
  const videoUrls = useMemo(() => getProductVideos(product), [product])

  const slides = useMemo(() => {
    const list = imageUrls.map((src) => ({ kind: 'image', src }))
    const poster = imageUrls[0] || ''
    for (const raw of videoUrls) {
      const v = String(raw).trim()
      if (!v) continue
      const yt = youtubeEmbed(v)
      if (yt) list.push({ kind: 'youtube', src: yt, poster })
      else if (isDirectVideoUrl(v)) list.push({ kind: 'video', src: v, poster })
    }
    return list
  }, [imageUrls, videoUrls])

  const [active, setActive] = useState(0)
  const [picked, setPicked] = useState(false)

  useEffect(() => {
    if (open) setActive(0)
  }, [open, product?.id])

  useEffect(() => {
    if (!open || !product) return
    setPicked(isProductPicked(product.id))
    const sync = () => setPicked(isProductPicked(product.id))
    window.addEventListener('taager-picks-update', sync)
    return () => window.removeEventListener('taager-picks-update', sync)
  }, [open, product])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || !product) return null

  const slide = slides[active] ?? slides[0]
  const { unit: price, old, currency } = getProductPricesForCountry(
    product,
    country,
  )
  const showStats =
    typeof product.rating === 'number' && typeof product.reviewCount === 'number'

  const handleTogglePick = () => {
    setPicked(toggleProductPick(product.id))
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-product-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <h2
            id="gallery-product-title"
            className="min-w-0 flex-1 text-base font-extrabold leading-snug text-gray-900 sm:text-lg"
          >
            {product.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-3 sm:flex-row sm:gap-4 sm:p-4 lg:overflow-y-auto">
            <div className="order-2 flex shrink-0 gap-2 overflow-x-auto pb-1 sm:order-1 sm:w-20 sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden sm:pb-0">
              {slides.map((sl, i) => (
                <button
                  key={`${sl.kind}-${i}-${sl.src}`}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-gray-100 sm:h-20 sm:w-full ${
                    active === i
                      ? 'border-temu ring-2 ring-orange-200'
                      : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                >
                  {sl.kind === 'image' && (
                    <img src={sl.src} alt="" className="h-full w-full object-cover" />
                  )}
                  {(sl.kind === 'video' || sl.kind === 'youtube') && (
                    <>
                      <img
                        src={sl.poster || imageUrls[0] || ''}
                        alt=""
                        className="h-full w-full object-cover opacity-70"
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-2xl text-white drop-shadow-md">
                        ▶
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>

            <div className="order-1 min-w-0 flex-1 sm:order-2">
              {slide?.kind === 'image' && <ZoomableImage src={slide.src} />}
              {slide?.kind === 'video' && (
                <div className="overflow-hidden rounded-xl bg-black">
                  <video
                    key={slide.src}
                    src={slide.src}
                    controls
                    playsInline
                    className="max-h-[min(60vh,520px)] w-full lg:max-h-[min(70vh,600px)]"
                  >
                    متصفحك لا يدعم تشغيل الفيديو.
                  </video>
                </div>
              )}
              {slide?.kind === 'youtube' && (
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                  <iframe
                    key={slide.src}
                    title="فيديو المنتج"
                    src={slide.src}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          </div>

          <aside className="shrink-0 border-t border-gray-100 px-4 py-4 lg:w-[min(100%,380px)] lg:border-s lg:border-t-0 lg:overflow-y-auto">
            <p className="text-sm leading-relaxed text-gray-600">{product.description}</p>

            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-black text-temu">
                {formatMoney(price, currency)}
              </span>
              <span className="text-base text-gray-400 line-through">
                {formatMoney(old, currency)}
              </span>
            </div>

            <QuantityPromoBadges product={product} country={country} />

            {showStats && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 pb-3 text-sm">
                <StarRowSmall rating={product.rating} />
                <span className="font-bold tabular-nums text-gray-900">
                  {product.rating.toFixed(1)}
                </span>
                <button
                  type="button"
                  className="text-temu underline-offset-2 hover:underline"
                  onClick={() =>
                    document
                      .getElementById('modal-reviews-heading')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                  }
                >
                  {product.reviewCount.toLocaleString('ar-SA')} تقييم
                </button>
                {typeof product.soldCount === 'number' &&
                  Number.isFinite(product.soldCount) &&
                  product.soldCount > 0 && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-600">
                        {formatSoldCompact(product.soldCount)} مبيع
                      </span>
                    </>
                  )}
              </div>
            )}

            <CustomerReviewsPanel product={product} />

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleTogglePick}
                className={`w-full rounded-full border-2 py-3 text-base font-extrabold transition ${
                  picked
                    ? 'border-green-600 bg-green-50 text-green-800'
                    : 'border-gray-300 bg-white text-gray-800 hover:border-temu hover:text-temu'
                }`}
              >
                {picked ? '✓ في مختاراتي' : 'أضف إلى مختاراتي'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onBuyNow(product)
                  onClose()
                }}
                className="w-full rounded-full bg-temu py-3 text-base font-extrabold text-white shadow-urgent hover:bg-temu-dark"
              >
                اشترِ الآن
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
