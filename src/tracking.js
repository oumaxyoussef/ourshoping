/**
 * Placeholder trackers for TikTok Events API / Pixel and Meta Pixel.
 * Replace console.debug with ttq.track / fbq once pixels are installed in index.html.
 */

export function tiktokViewContent(payload) {
  if (typeof window !== 'undefined' && window.ttq?.track) {
    window.ttq.track('ViewContent', payload)
  } else {
    console.debug('[TikTok Pixel] ViewContent', payload)
  }
}

export function tiktokLead(payload) {
  if (typeof window !== 'undefined' && window.ttq?.track) {
    window.ttq.track('Lead', payload)
  } else {
    console.debug('[TikTok Pixel] Lead', payload)
  }
}

export function metaViewContent(payload) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'ViewContent', payload)
  } else {
    console.debug('[Meta Pixel] ViewContent', payload)
  }
}

export function metaLead(payload) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Lead', payload)
  } else {
    console.debug('[Meta Pixel] Lead', payload)
  }
}

export function trackProductView(product, _displayCurrency) {
  const value = Number(product?.priceSar) || 0
  const data = {
    content_ids: [product.id],
    content_type: 'product',
    content_name: product.title,
    value,
    currency: 'SAR',
  }
  tiktokViewContent(data)
  metaViewContent(data)
}

export function trackCheckoutLead(formData, product) {
  const payload = {
    content_name: product?.title ?? 'checkout',
    ...formData,
  }
  tiktokLead(payload)
  metaLead(payload)
}
