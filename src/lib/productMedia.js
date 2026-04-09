export const MAX_PHOTOS = 10
export const MAX_VIDEOS = 3
/** حجم الملف الأصلي المسموح به قبل الضغط (صور الهاتف الكبيرة) */
export const MAX_IMAGE_UPLOAD_BYTES = 32 * 1024 * 1024
/** للتوافق مع الكود القديم — كان حد الرفع قبل الضغط */
export const MAX_IMAGE_FILE_BYTES = MAX_IMAGE_UPLOAD_BYTES
export const MAX_VIDEO_FILE_BYTES = 35 * 1024 * 1024

/** طول data URL مستهدف بعد الضغط (~أقل من 1 ميجا نص) لتفادي امتلاء localStorage */
const TARGET_DATA_URL_CHARS = 950_000

function fitInsideMaxEdge(width, height, maxEdge) {
  if (width <= 0 || height <= 0) return { w: 1, h: 1 }
  if (width <= maxEdge && height <= maxEdge) {
    return { w: Math.round(width), h: Math.round(height) }
  }
  const r = Math.min(maxEdge / width, maxEdge / height)
  return {
    w: Math.max(1, Math.round(width * r)),
    h: Math.max(1, Math.round(height * r)),
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('فشل تحميل الصورة'))
    }
    img.decoding = 'async'
    img.src = url
  })
}

/**
 * يصغّر الصورة ويضغطها كـ JPEG لتخزينها في localStorage دون تجاوز الحصة بسهولة.
 */
export async function compressImageFileToDataUrl(file) {
  const img = await loadImageElement(file)
  let maxEdge = 1920
  let quality = 0.82
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('المتصفح لا يدعم معالجة الصور')

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { w, h } = fitInsideMaxEdge(img.naturalWidth || img.width, img.naturalHeight || img.height, maxEdge)
    canvas.width = w
    canvas.height = h
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= TARGET_DATA_URL_CHARS || (maxEdge <= 640 && quality <= 0.42)) {
      return dataUrl
    }
    if (quality > 0.45) {
      quality = Math.max(0.42, quality - 0.09)
    } else {
      quality = 0.78
      maxEdge = Math.max(480, Math.floor(maxEdge * 0.82))
    }
  }
  return canvas.toDataURL('image/jpeg', 0.4)
}

/** صور المنتج: `photos` أو التوافق مع image + images */
export function getProductPhotos(p) {
  if (Array.isArray(p?.photos) && p.photos.length > 0) {
    const out = []
    const seen = new Set()
    for (const u of p.photos) {
      if (typeof u !== 'string' || !u.trim()) continue
      const t = u.trim()
      if (seen.has(t)) continue
      seen.add(t)
      out.push(t)
      if (out.length >= MAX_PHOTOS) break
    }
    return out
  }
  const main = p?.image && String(p.image).trim() ? [String(p.image).trim()] : []
  const extras = Array.isArray(p?.images) ? p.images : []
  const seen = new Set()
  const out = []
  for (const u of [...main, ...extras]) {
    if (typeof u !== 'string' || !u.trim()) continue
    const t = u.trim()
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= MAX_PHOTOS) break
  }
  return out
}

/** فيديوهات: `videos` أو video واحد قديم */
export function getProductVideos(p) {
  if (Array.isArray(p?.videos) && p.videos.length > 0) {
    const out = []
    const seen = new Set()
    for (const u of p.videos) {
      if (typeof u !== 'string' || !u.trim()) continue
      const t = u.trim()
      if (seen.has(t)) continue
      seen.add(t)
      out.push(t)
      if (out.length >= MAX_VIDEOS) break
    }
    return out
  }
  const v = p?.video && String(p.video).trim()
  return v ? [v] : []
}

/** يملأ image / images / video للتوافق مع الكود القديم */
export function attachLegacyMediaFields(p) {
  const photos = getProductPhotos(p).slice(0, MAX_PHOTOS)
  const videos = getProductVideos(p).slice(0, MAX_VIDEOS)
  return {
    ...p,
    photos,
    videos,
    image: photos[0] || '',
    images: photos.slice(1),
    video: videos[0] || '',
  }
}

export function isValidImageRef(s) {
  if (!s || typeof s !== 'string') return false
  if (s.startsWith('data:image/')) return true
  try {
    new URL(s)
    return true
  } catch {
    return false
  }
}

export function isValidVideoRef(s) {
  if (!s || typeof s !== 'string') return false
  if (s.startsWith('data:video/')) return true
  try {
    const u = new URL(s.trim())
    if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') return true
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(u.pathname + u.search)
  } catch {
    return false
  }
}

/**
 * @param {FileList|File[]} files
 * @param {{ maxCount: number, maxBytesPerFile: number, acceptPrefix: string }} opts
 * للصور: يُضغط تلقائياً مهما كان حجم الملف الأصلي (ضمن maxBytesPerFile).
 * للفيديو: يُقرأ كما هو ضمن الحد.
 */
export async function readFilesAsDataUrls(files, opts) {
  const list = Array.from(files || []).slice(0, opts.maxCount)
  const out = []
  const isImage = opts.acceptPrefix?.startsWith('image')
  const rawLimit = isImage ? MAX_IMAGE_UPLOAD_BYTES : opts.maxBytesPerFile

  for (const file of list) {
    if (opts.acceptPrefix && !file.type.startsWith(opts.acceptPrefix)) {
      throw new Error('نوع الملف غير مدعوم')
    }
    if (file.size > rawLimit) {
      throw new Error(
        isImage
          ? `صورة كبيرة جداً قبل المعالجة (الحد ≈ ${Math.round(rawLimit / 1048576)} ميجا)`
          : `فيديو كبير جداً (الحد ${Math.round(opts.maxBytesPerFile / 1048576)} ميجا)`,
      )
    }
    if (isImage) {
      out.push(await compressImageFileToDataUrl(file))
    } else {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(new Error('فشل قراءة الملف'))
        r.readAsDataURL(file)
      })
      out.push(dataUrl)
    }
  }
  return out
}

export function mediaSummaryText(p) {
  const nP = getProductPhotos(p).length
  const nV = getProductVideos(p).length
  const parts = []
  if (nP) parts.push(`${nP} صورة`)
  if (nV) parts.push(`${nV} فيديو`)
  return parts.length ? parts.join('، ') : '—'
}
