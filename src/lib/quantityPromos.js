export const MAX_QUANTITY_PROMOS = 5

/** بيانات خصم الكمية من المنتج */
export function getQuantityPromos(p) {
  const raw = p?.quantityPromos
  if (!Array.isArray(raw)) return []
  const mapped = raw
    .map((row) => ({
      quantity: Number(row.quantity),
      priceSar: Number(row.priceSar),
      priceAed: Number(row.priceAed),
    }))
    .filter(
      (r) =>
        Number.isInteger(r.quantity) &&
        r.quantity >= 2 &&
        Number.isFinite(r.priceSar) &&
        r.priceSar > 0 &&
        Number.isFinite(r.priceAed) &&
        r.priceAed > 0,
    )
    .sort((a, b) => a.quantity - b.quantity)
  const seen = new Set()
  const out = []
  for (const r of mapped) {
    if (seen.has(r.quantity)) continue
    seen.add(r.quantity)
    out.push(r)
    if (out.length >= MAX_QUANTITY_PROMOS) break
  }
  return out
}

export function bundleDiscountPercent(unitPrice, quantity, bundlePrice) {
  if (!quantity || quantity < 1 || !unitPrice || unitPrice <= 0) return 0
  const atUnit = quantity * unitPrice
  if (bundlePrice >= atUnit) return 0
  return Math.min(99, Math.round((1 - bundlePrice / atUnit) * 100))
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

/** أقل سعر فعلي للقطعة: السعر الأساسي أو أفضل عرض كمية. */
function minEffectiveUnitPerCurrency(promos, unitSar, unitAed) {
  let minSar = unitSar
  let minAed = unitAed
  for (const p of promos) {
    const uS = p.priceSar / p.quantity
    const uA = p.priceAed / p.quantity
    if (uS < minSar) minSar = uS
    if (uA < minAed) minAed = uA
  }
  return { minSar, minAed }
}

/**
 * سعر السطر: بند مطابق → سعر الباقة؛ إذا تجاوزت الكمية أكبر عرض → أقل سعر قطعة × الكمية؛ وإلا السعر الواحد × الكمية.
 */
export function computeOrderLinePrice(product, currency, quantity) {
  const q = Math.max(1, Math.min(99, Math.floor(Number(quantity)) || 1))
  const unitSar = Number(product?.priceSar)
  const unitAed = Number(product?.priceAed)
  const promos = getQuantityPromos(product)
  const match = promos.find((p) => p.quantity === q)
  if (match) {
    const lineTotalSar = match.priceSar
    const lineTotalAed = match.priceAed
    return {
      quantity: q,
      unitPriceSar: lineTotalSar / q,
      unitPriceAed: lineTotalAed / q,
      lineTotalSar,
      lineTotalAed,
      isPromoBundle: true,
      isMinUnitOverflow: false,
    }
  }
  if (q === 1) {
    return {
      quantity: q,
      unitPriceSar: unitSar,
      unitPriceAed: unitAed,
      lineTotalSar: unitSar,
      lineTotalAed: unitAed,
      isPromoBundle: false,
      isMinUnitOverflow: false,
    }
  }
  if (promos.length > 0) {
    const maxPromoQty = Math.max(...promos.map((p) => p.quantity))
    if (q > maxPromoQty) {
      const { minSar, minAed } = minEffectiveUnitPerCurrency(
        promos,
        unitSar,
        unitAed,
      )
      const lineTotalSar = roundMoney(minSar * q)
      const lineTotalAed = roundMoney(minAed * q)
      return {
        quantity: q,
        unitPriceSar: lineTotalSar / q,
        unitPriceAed: lineTotalAed / q,
        lineTotalSar,
        lineTotalAed,
        isPromoBundle: false,
        isMinUnitOverflow: true,
      }
    }
  }
  return {
    quantity: q,
    unitPriceSar: unitSar,
    unitPriceAed: unitAed,
    lineTotalSar: unitSar * q,
    lineTotalAed: unitAed * q,
    isPromoBundle: false,
    isMinUnitOverflow: false,
  }
}
