import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['atleta', 'dm', 'gestao']);

export const modalityCategoryEnum = pgEnum('modality_category', ['masculino', 'feminino', 'misto']);

export const teamJoinRequestStatusEnum = pgEnum('team_join_request_status', [
  'pending',
  'approved',
  'rejected',
]);

export const requiredDocumentTypeEnum = pgEnum('required_document_type', [
  'id_document',
  'photo_3x4',
  'enrollment_declaration',
]);

export const athleteDocumentStatusEnum = pgEnum('athlete_document_status', [
  'pending',
  'submitted',
  'approved',
  'rejected',
]);

export const competitionRegistrationStatusEnum = pgEnum('competition_registration_status', [
  'draft',
  'confirmed',
  'cancelled',
]);

export const stockMovementReasonEnum = pgEnum('stock_movement_reason', [
  'reservation',
  'restock',
  'cancellation',
  'adjustment',
]);

export const reservationStatusEnum = pgEnum('reservation_status', [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
]);

export const duesPaymentStatusEnum = pgEnum('dues_payment_status', ['paid', 'pending']);

export const tournamentModalityFormatEnum = pgEnum('tournament_modality_format', [
  'single_elimination',
  'round_robin',
  'grouped_round_robin',
  'fixed_ranking',
  'reorderable_ranking',
]);

export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'completed']);

export const matchSlotEnum = pgEnum('match_slot', ['a', 'b']);

// Explicit per-participant outcome — never inferred/guessed. A draw is only
// ever recorded because the caller explicitly said so for both sides.
export const matchOutcomeEnum = pgEnum('match_outcome', ['win', 'draw', 'loss']);
