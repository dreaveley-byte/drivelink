// Shrinks a photo in the browser before it's uploaded.
//
// Phone cameras produce 3-6 MB originals, and the receipt/tracking pages
// show them as ~80px thumbnails that each still download the full file -
// so one job with a few dozen photos could cost tens of MB every time
// someone opened it. Re-encoding to a sensible size at upload time cuts
// storage and every later download by roughly 10x with no visible
// difference at the sizes these photos are actually viewed.
//
// Never blocks an upload: anything unexpected (unsupported format, a
// browser that can't decode it, no canvas) just returns the original file
// untouched, and so does a result that somehow came out larger.

export type CompressImageOptions = {
  /** Longest edge in pixels. Default 1600. */
  maxDimension?: number
  /** JPEG quality 0-1. Default 0.72. */
  quality?: number
  /** Files already smaller than this are left alone. Default 250 KB. */
  skipBelowBytes?: number
}

// For anything where small print has to stay readable: receipts,
// registration, inspection reports, driver documents.
export const DOCUMENT_COMPRESSION: CompressImageOptions = { maxDimension: 2000, quality: 0.78 }

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

async function decode(file: File): Promise<Decoded> {
  // createImageBitmap applies the photo's rotation (EXIF) so phone photos
  // don't come out sideways. Older browsers reject the option, so fall
  // back to a plain <img>, which handles rotation itself.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // fall through to the <img> path
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function compressImage(file: File, options: CompressImageOptions = {}): Promise<File> {
  const { maxDimension = 1600, quality = 0.72, skipBelowBytes = 250 * 1024 } = options
  try {
    if (typeof document === 'undefined') return file
    if (!file.type.startsWith('image/')) return file // videos, PDFs, etc.
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file
    if (file.size < skipBelowBytes) return file

    const decoded = await decode(file)
    try {
      if (!decoded.width || !decoded.height) return file
      const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height))
      const width = Math.max(1, Math.round(decoded.width * scale))
      const height = Math.max(1, Math.round(decoded.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      // JPEG has no transparency - without this a transparent PNG would
      // come out with a black background.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(decoded.source, 0, 0, width, height)

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob || blob.size >= file.size) return file

      const base = file.name.replace(/\.[^./\\]+$/, '') || 'photo'
      return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
    } finally {
      decoded.release()
    }
  } catch {
    return file
  }
}
