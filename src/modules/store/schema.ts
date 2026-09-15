import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  priceCents: z.number().int().min(0),
  imageUrl: z.string().url().optional(),
  stock: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.omit({ stock: true }).partial();

export const createReservationSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  contactName: z.string().trim().min(1).max(160),
  contactPhone: z.string().trim().min(1).max(30),
  note: z.string().trim().max(500).optional(),
});

export const updateReservationStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
});
