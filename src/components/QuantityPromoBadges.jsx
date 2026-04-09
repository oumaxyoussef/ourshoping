import { useEffect, useState } from 'react'
import { currencyForCountry } from '../lib/countries.js'
import { formatMoney } from '../lib/money.js'
import { getBundleRowDisplay } from '../lib/pricing.js'
import { bundleDiscountPercent, getQuantityPromos } from '../lib/quantityPromos.js'

const ROTATE_MS = 3200

function LightningTiny() {
  return (
    <svg
      className="h-2.5 w-2.5 shrink-0 text-amber-200 drop-shadow sm:h-3 sm:w-3"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
    </svg>
  )
}

function PromoBadgeRow({ row, displayCurrency, unitSar, swapClass }) {
  const bundleSar = Number(row.priceSar)
  const pct = bundleDiscountPercent(unitSar, row.quantity, bundleSar)
  const bundleDisplay = getBundleRowDisplay(row, displayCurrency)
  return (
    <div
      role="listitem"
      className={`qty-promo-badge flex items-center justify-center gap-0.5 rounded-md px-1.5 py-0.5 text-center text-[9px] font-extrabold leading-snug text-white shadow-sm sm:gap-1 sm:px-2 sm:py-1 sm:text-[10px] ${swapClass}`}
    >
      <LightningTiny />
      <span>
        {row.quantity} قطع · {formatMoney(bundleDisplay, displayCurrency)}
        {pct > 0 ? ` (${pct}% خصم)` : ''}
      </span>
      <LightningTiny />
    </div>
  )
}

export default function QuantityPromoBadges({ product, country, compact }) {
  const promos = getQuantityPromos(product)
  const displayCurrency = country ? currencyForCountry(country) : 'SAR'
  const unitSar = Number(product.priceSar)

  const [active, setActive] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const fn = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  useEffect(() => {
    setActive(0)
  }, [product?.id, country])

  useEffect(() => {
    if (reducedMotion || promos.length <= 1) return
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % promos.length)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [promos.length, reducedMotion])

  if (!promos.length) return null

  const titleClass = compact
    ? 'text-[9px] font-extrabold text-violet-800 sm:text-[10px]'
    : 'text-[10px] font-extrabold text-violet-800 sm:text-xs'

  if (reducedMotion || promos.length === 1) {
    return (
      <div className={compact ? 'mt-1.5 space-y-0.5' : 'mt-2 space-y-1'} role="list">
        <p className={titleClass}>⚡ الخصم على الكميات</p>
        {promos.map((row) => (
          <PromoBadgeRow
            key={row.quantity}
            row={row}
            displayCurrency={displayCurrency}
            unitSar={unitSar}
            swapClass=""
          />
        ))}
      </div>
    )
  }

  const row = promos[active]

  return (
    <div className={compact ? 'mt-1.5' : 'mt-2'} role="list">
      <p className={titleClass}>⚡ الخصم على الكميات</p>
      <div className="relative mt-0.5 min-h-[1.5rem] sm:min-h-[1.75rem]">
        <PromoBadgeRow
          key={`${row.quantity}-${active}`}
          row={row}
          displayCurrency={displayCurrency}
          unitSar={unitSar}
          swapClass="qty-promo-badge--swap"
        />
      </div>
      {promos.length > 1 && (
        <div
          className="mt-1 flex justify-center gap-1"
          aria-hidden
        >
          {promos.map((_, di) => (
            <span
              key={di}
              className={`h-1 w-1 rounded-full transition-colors ${
                di === active ? 'bg-violet-600' : 'bg-violet-200'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
