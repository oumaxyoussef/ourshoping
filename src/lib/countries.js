/** رموز الدول المدعومة للعرض والشحن (أسواق المنتج) */
export const COUNTRIES = [
  { id: 'EG', nameAr: 'مصر', flag: '🇪🇬' },
  { id: 'SA', nameAr: 'المملكة العربية السعودية', flag: '🇸🇦' },
  { id: 'AE', nameAr: 'الإمارات العربية المتحدة', flag: '🇦🇪' },
  { id: 'IQ', nameAr: 'العراق', flag: '🇮🇶' },
  { id: 'OM', nameAr: 'عُمان', flag: '🇴🇲' },
]

export const COUNTRY_IDS = COUNTRIES.map((c) => c.id)

export const COUNTRY_BY_ID = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c]),
)

const STORAGE_KEY = 'taager_selected_country'

/** عملة العرض حسب بلد التسوق */
export function currencyForCountry(countryId) {
  switch (countryId) {
    case 'AE':
      return 'AED'
    case 'EG':
      return 'EGP'
    case 'IQ':
      return 'IQD'
    case 'OM':
      return 'OMR'
    case 'SA':
    default:
      return 'SAR'
  }
}

export function getStoredCountry() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && COUNTRY_IDS.includes(v)) return v
  } catch {
    /* ignore */
  }
  return 'SA'
}

export function setStoredCountry(countryId) {
  if (!COUNTRY_IDS.includes(countryId)) return
  try {
    localStorage.setItem(STORAGE_KEY, countryId)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('taager-country-change', { detail: countryId }))
}

/** بادئة الجوال الدولية حسب بلد التسوق */
export const PHONE_PREFIX_BY_COUNTRY = {
  EG: '+20',
  SA: '+966',
  AE: '+971',
  IQ: '+964',
  OM: '+968',
}

export function defaultPhonePrefixForCountry(countryId) {
  if (!countryId || !COUNTRY_IDS.includes(countryId)) return '+966'
  return PHONE_PREFIX_BY_COUNTRY[countryId] ?? '+966'
}

/** عدد الأرقام الوطنية بعد رمز الدولة (بدون +) */
export function nationalPhoneDigitsForPrefix(prefix) {
  switch (prefix) {
    case '+966':
    case '+971':
      return 9
    case '+20':
    case '+964':
      return 10
    case '+968':
      return 8
    default:
      return 15
  }
}

/** مثال توضيحي لحقل الرقم الوطني */
export function phoneRestPlaceholder(prefix) {
  switch (prefix) {
    case '+966':
    case '+971':
      return '5xxxxxxxx'
    case '+20':
      return '1xxxxxxxxx'
    case '+964':
      return '7xxxxxxxxx'
    case '+968':
      return '9xxxxxxx'
    default:
      return ''
  }
}

/**
 * ينظف الرقم الوطني: يزيل الأحرف غير الرقمية والصفر البادئ اختيارياً.
 * مثال: "01234567890" ← "1234567890"
 */
export function sanitizePhoneRest(value) {
  const digits = String(value).replace(/\D/g, '')
  // إذا بدأ الرقم بصفر (مثل 01x في مصر) نحذف الصفر تلقائياً
  return digits.startsWith('0') ? digits.slice(1) : digits
}

/**
 * رقم كامل بصيغة دولية: +966/+971 تسعة أرقام، +20/+964 عشرة، +968 ثمانية.
 */
export function isValidFullPhone(fullPhone) {
  // normalize: strip leading 0 after country code if present (e.g. +20 0xxxxxxxxxx → +20 xxxxxxxxxx)
  const s = String(fullPhone).replace(/\s/g, '').replace(/^(\+\d{1,4})0(\d)/, '$1$2')
  if (/^\+966[0-9]{9}$/.test(s)) return true
  if (/^\+971[0-9]{9}$/.test(s)) return true
  if (/^\+20[0-9]{10}$/.test(s)) return true
  if (/^\+964[0-9]{9,10}$/.test(s)) return true
  if (/^\+968[0-9]{8}$/.test(s)) return true
  return false
}
