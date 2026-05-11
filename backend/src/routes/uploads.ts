import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { processImage, deleteImage } from '../lib/image';
import { validateImageFile } from '../lib/validators';
import { randomBytes } from 'crypto';

export const uploads = new Hono();

// All upload routes require authentication
uploads.use('*', authMiddleware);

// POST /uploads — Upload and process a single image
uploads.post('/', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return c.json({ error: 'No image provided. Send a file in the "image" field.' }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate MIME type, size, and magic bytes
    const validation = validateImageFile(file, buffer);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    // Generate a random filename (never trust the original)
    const randomName = randomBytes(12).toString('hex');
    const result = await processImage(buffer, `${randomName}.img`);

    return c.json(result, 201);
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Failed to upload image' }, 500);
  }
});

// DELETE /uploads — Delete an image set by its base name
uploads.delete('/:name', async (c) => {
  const name = c.req.param('name');

  if (!name || !/^[a-f0-9]+$/.test(name)) {
    return c.json({ error: 'Invalid image name' }, 400);
  }

  try {
    await deleteImage(name);
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete image error:', error);
    return c.json({ error: 'Failed to delete image' }, 500);
  }
});
