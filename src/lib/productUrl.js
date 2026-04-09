/** رابط صفحة منتج واحد (إعلانات، مشاركة) */
export function productLandingPath(productId) {
  return `/p/${encodeURIComponent(String(productId))}`
}
