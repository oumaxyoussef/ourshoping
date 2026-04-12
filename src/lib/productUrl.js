/** رابط صفحة منتج واحد (إعلانات، مشاركة) */
export function productLandingPath(productId, country) {
  const base = `/p/${encodeURIComponent(String(productId))}`
  return country ? `${base}?c=${encodeURIComponent(country)}` : base
}
