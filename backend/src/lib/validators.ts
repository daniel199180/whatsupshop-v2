import { z } from 'zod';

// ─── Product Validation ───────────────────────────────────────────────
export const createProductSchema = z.object({
  slug: z.string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only'),
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().min(1, 'Description is required'),
  normalPrice: z.number().positive('Price must be positive'),
  discountPrice: z.number().min(0).optional().default(0),
  imageUrl: z.string().min(1, 'Image URL is required').max(500),
  imageFallback: z.string().max(500).optional().nullable(),
  thumbnail: z.string().max(500).optional().nullable(),
  options: z.any().optional().nullable(),
  moreImages: z.any().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

// ─── Category Validation ──────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
});

export const updateCategorySchema = createCategorySchema;

// ─── Order Validation ─────────────────────────────────────────────────
export const createOrderSchema = z.object({
  message: z.string().min(1, 'Order message is required'),
});

// ─── Config Validation ────────────────────────────────────────────────
export const upsertConfigSchema = z.object({
  key: z.string().min(1, 'Config key is required').max(100),
  value: z.string().min(1, 'Config value is required'),
});

// ─── Login Validation ─────────────────────────────────────────────────
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Image Upload Validation ──────────────────────────────────────────
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validates an uploaded file's MIME type, size, and magic bytes.
 * Returns { valid: true, type } on success or { valid: false, error } on failure.
 */
export function validateImageFile(file: File, buffer: Buffer): { valid: true; type: string } | { valid: false; error: string } {
  // Check MIME type from header
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return { valid: false, error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 10MB` };
  }

  // Validate magic bytes (file signature)
  const magicBytes = buffer.subarray(0, 12);

  const isJPEG = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
  const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
  // RIFF....WEBP
  const isWEBP = magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46
    && magicBytes[8] === 0x57 && magicBytes[9] === 0x45 && magicBytes[10] === 0x42 && magicBytes[11] === 0x50;

  if (!isJPEG && !isPNG && !isWEBP) {
    return { valid: false, error: 'File content does not match a valid image format (magic bytes mismatch)' };
  }

  const detectedType = isJPEG ? 'image/jpeg' : isPNG ? 'image/png' : 'image/webp';
  return { valid: true, type: detectedType };
}
