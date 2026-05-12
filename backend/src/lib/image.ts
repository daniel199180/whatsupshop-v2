// Lazy import: sharp is loaded only when needed to avoid crashes if native module is unavailable
const getSharp = async () => (await import('sharp')).default;
import { join } from 'path';
import { writeFile, mkdir, unlink, access } from 'fs/promises';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

/**
 * Processes an uploaded image buffer into three optimized variants:
 * 1. WebP (main) — resized to max 1080px width, quality 75
 * 2. JPG (fallback) — same size, for browsers without WebP support
 * 3. Thumbnail (WebP) — 400x400 cover crop for grid/card views
 */
export const processImage = async (buffer: Buffer, filename: string) => {
  // Ensure upload directory exists
  await mkdir(UPLOAD_DIR, { recursive: true });

  const nameWithoutExt = filename.split('.')[0]!;
  const webpName = `${nameWithoutExt}.webp`;
  const jpgName = `${nameWithoutExt}.jpg`;
  const thumbName = `${nameWithoutExt}-thumb.webp`;

  // Clone the sharp instance for each output (sharp pipelines are single-use)
  const sharp = await getSharp();
  const mainImage = sharp(buffer).rotate(); // auto-rotate based on EXIF

  // Main WebP — 900px max, effort 6 (best compression/quality ratio for catalog)
  const webpBuffer = await mainImage
    .clone()
    .resize(900, null, { withoutEnlargement: true })
    .webp({ quality: 72, effort: 6, smartSubsample: true })
    .toBuffer();

  // Fallback JPG — same size, mozjpeg encoder
  const jpgBuffer = await mainImage
    .clone()
    .resize(900, null, { withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true, progressive: true })
    .toBuffer();

  // Thumbnail WebP — 320×320 square crop, heavy compression (shown small in grids)
  const thumbBuffer = await mainImage
    .clone()
    .resize(320, 320, { fit: 'cover', position: 'centre' })
    .webp({ quality: 65, effort: 6, smartSubsample: true })
    .toBuffer();

  // Write all files
  await Promise.all([
    writeFile(join(UPLOAD_DIR, webpName), webpBuffer),
    writeFile(join(UPLOAD_DIR, jpgName), jpgBuffer),
    writeFile(join(UPLOAD_DIR, thumbName), thumbBuffer),
  ]);

  return {
    imageUrl: `${PUBLIC_URL}/uploads/${webpName}`,
    imageFallback: `${PUBLIC_URL}/uploads/${jpgName}`,
    thumbnail: `${PUBLIC_URL}/uploads/${thumbName}`,
    baseName: nameWithoutExt,
    sizes: {
      webp: webpBuffer.length,
      jpg: jpgBuffer.length,
      thumb: thumbBuffer.length,
    },
  };
};

/**
 * Deletes all image variants for a given base name.
 * Silently ignores files that don't exist.
 */
export const deleteImage = async (baseName: string) => {
  const files = [
    join(UPLOAD_DIR, `${baseName}.webp`),
    join(UPLOAD_DIR, `${baseName}.jpg`),
    join(UPLOAD_DIR, `${baseName}-thumb.webp`),
  ];

  await Promise.all(
    files.map(async (filePath) => {
      try {
        await access(filePath);
        await unlink(filePath);
      } catch {
        // File doesn't exist, skip silently
      }
    })
  );
};
