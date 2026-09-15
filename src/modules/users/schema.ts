import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination.js';

export const updateOwnProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  cpf: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{11}$/, 'CPF must have 11 digits')),
  rg: z.string().trim().min(1).max(30),
  birthDate: z.string().date(),
  course: z.string().trim().max(200).optional(),
  instagram: z
    .string()
    .trim()
    .max(60)
    .transform((value) => value.replace(/^@/, ''))
    .optional(),
  phone: z.string().trim().max(30).optional(),
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
