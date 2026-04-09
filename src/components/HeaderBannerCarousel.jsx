import { useEffect, useState } from 'react'

const AUTO_MS = 4500

/**
 * قسم الهيرو: صور تمرّ تلقائياً مع نفس بلوك «أقل الأسعار في الخليج» والعدّ التنازلي
 */
export default function HeaderBannerCarousel({ urls, children }) {
  const slides = Array.isArray(urls) && urls.length > 0 ? urls : []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const slidesKey = slides.join('\0')

  useEffect(() => {
    setIndex(0)
  }, [slidesKey])

  useEffect(() => {
    if (slides.length <= 1 || paused) return undefined
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, AUTO_MS)
    return () => window.clearInterval(id)
  }, [slides.length, paused, slidesKey])

  const hasImages = slides.length > 0

  return (
    <section
      className="relative mb-4 overflow-hidden rounded-2xl border border-orange-200/30 text-white shadow-urgent sm:mb-6"
      aria-label="عروض ومزايا المتجر"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* خلفيات متحركة */}
      {hasImages && (
        <div className="absolute inset-0 min-h-[280px] sm:min-h-[320px]">
          {slides.map((src, i) => (
            <img
              key={`${src.slice(0, 48)}-${i}`}
              src={src}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
                i === index ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              loading={i === 0 ? 'eager' : 'lazy'}
              draggable={false}
            />
          ))}
        </div>
      )}

      {/* طبقة لونية موحّدة مع المحتوى النصي (مع أو بدون صور) */}
      <div
        className={`absolute inset-0 min-h-[280px] sm:min-h-[320px] ${
          hasImages
            ? 'bg-gradient-to-br from-temu/88 via-temu-dark/82 to-orange-950/88'
            : 'bg-gradient-to-br from-temu via-temu-dark to-orange-700'
        }`}
      />
      <div className="pointer-events-none absolute -start-20 -top-20 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -end-10 h-32 w-32 rounded-full bg-yellow-300/15 blur-xl" />

      <div className="relative z-10 px-4 py-8 sm:px-8 sm:py-12">{children}</div>

      {hasImages && slides.length > 1 && (
        <div className="relative z-20 flex justify-center pb-4">
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`شريحة ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
