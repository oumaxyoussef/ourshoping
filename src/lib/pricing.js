import { currencyForCountry } from './countries.js'

/**
 * تحويل من الريال السعودي (الأساس في لوحة التحكم) إلى عملات العرض.
 * الأسعار تقريبية للعرض — يمكن تعديل المعاملات هنا.
 */
const SAR_MULTIPLIER = {
  SAR: 1,
  /** ~1 SAR = 0.978 AED */
  AED: 0.978,
  /** جنيه مصري */
  EGP: 13.15,
  /** دينار عراقي */
  IQD: 348,
  /** ريال عُماني */
  OMR: 0.102,
}

export function convertSarToCurrency(amountSar, currency) {
  const n = Number(amountSar)
  if (!Number.isFinite(n)) return 0
  const m = SAR_MULTIPLIER[currency]
  if (m == null) return n
  const out = n * m
  return roundForCurrency(out, currency)
}

/** تحويل عكسي: من أي عملة عرض إلى الريال السعودي */
export function convertCurrencyToSar(amount, currency) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return 0
  const m = SAR_MULTIPLIER[currency]
  if (m == null || m <= 0) return roundForCurrency(n, 'SAR')
  return roundForCurrency(n / m, 'SAR')
}

function roundForCurrency(n, currency) {
  if (currency === 'EGP' || currency === 'IQD') return Math.round(n)
  if (currency === 'OMR') return Math.round(n * 1000) / 1000
  return Math.round(n * 100) / 100
}

/** سعر الوحدة وقبل الخصم بعملة بلد الزائر */
export function getProductPricesForCountry(product, countryId) {
  const cur = currencyForCountry(countryId)
  const unitSar = Number(product?.priceSar)
  const oldSar = Number(product?.oldPriceSar)
  if (cur === 'SAR') {
    return { currency: 'SAR', unit: unitSar, old: oldSar }
  }
  if (cur === 'AED') {
    return {
      currency: 'AED',
      unit: Number(product?.priceAed) || convertSarToCurrency(unitSar, 'AED'),
      old: Number(product?.oldPriceAed) || convertSarToCurrency(oldSar, 'AED'),
    }
  }
  return {
    currency: cur,
    unit: convertSarToCurrency(unitSar, cur),
    old: convertSarToCurrency(oldSar, cur),
  }
}

/**
 * مبالغ الدفع المعروضة: الإمارات من حقول المنتج بالدرهم،
 * باقي العملات من تحويل الريال.
 */
export function getOrderLineDisplayAmounts(orderLine, currency) {
  if (!orderLine) return { unit: 0, line: 0 }
  if (currency === 'SAR') {
    return {
      unit: orderLine.unitPriceSar,
      line: orderLine.lineTotalSar,
    }
  }
  if (currency === 'AED') {
    return {
      unit: orderLine.unitPriceAed,
      line: orderLine.lineTotalAed,
    }
  }
  return {
    unit: convertSarToCurrency(orderLine.unitPriceSar, currency),
    line: convertSarToCurrency(orderLine.lineTotalSar, currency),
  }
}

/** سعر باقة كمية بعملة العرض */
export function getBundleRowDisplay(row, currency) {
  const ps = Number(row.priceSar)
  const pa = Number(row.priceAed)
  if (currency === 'SAR') return ps
  if (currency === 'AED') return pa || convertSarToCurrency(ps, 'AED')
  return convertSarToCurrency(ps, currency)
}

/** عند الحفظ من الإدارة: اشتقاق الد.إ من الر.س */
export function deriveAedFromSar(priceSar, oldPriceSar) {
  return {
    priceAed: convertSarToCurrency(priceSar, 'AED'),
    oldPriceAed: convertSarToCurrency(oldPriceSar, 'AED'),
  }
}
