import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination.js';

// A true partial update: every field is optional, and only fields actually
// present in the request are changed (see repository.updateOwnProfile,
// which builds its SET clause from exactly these keys — never nulling out
// a field the caller didn't mention).
export const updateOwnProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    cpf: z
      .string()
      .transform((value) => value.replace(/\D/g, ''))
      .pipe(z.string().regex(/^\d{11}$/, 'CPF must have 11 digits')),
    rg: z.string().trim().min(1).max(30),
    birthDate: z.string().date(),
    course: z.string().trim().max(200),
    instagram: z
      .string()
      .trim()
      .max(60)
      .transform((value) => value.replace(/^@/, '')),
    phone: z.string().trim().max(30),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

export const updateRoleSchema = z.object({
  role: z.enum(['atleta', 'dm', 'gestao']),
});

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
});

export interface UserProfileResponse {
  id: string;
  email: string;
  fullName: string | null;
  cpfMask: string | null;
  rg: string | null;
  birthDate: string | null;
  course: string | null;
  instagram: string | null;
  phone: string | null;
  role: 'atleta' | 'dm' | 'gestao';
  active: boolean;
}
