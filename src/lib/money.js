export function formatMoney(amount, currency) {
  const n = Number(amount)
  if (Number.isNaN(n)) return '—'
  let s
  if (currency === 'IQD' || currency === 'EGP') {
    s = String(Math.round(n))
  } else if (currency === 'OMR') {
    s = n.toFixed(3).replace(/\.?0+$/, '')
  } else {
    s = Number.isInteger(n)
      ? String(n)
      : n.toFixed(2).replace(/\.?0+$/, '')
  }
  if (currency === 'SAR') return `${s} ر.س`
  if (currency === 'AED') return `${s} د.إ`
  if (currency === 'EGP') return `${s} ج.م`
  if (currency === 'IQD') return `${s} د.ع`
  if (currency === 'OMR') return `${s} ر.ع`
  return `${s} ${currency}`
}
