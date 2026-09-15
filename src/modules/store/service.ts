import { db } from '../../database/client.js';
import { recordAudit } from '../audit/repository.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';
import {
  createProduct as createProductRepo,
  createReservationRow,
  findProductById,
  findProductForUpdate,
  findReservationForUpdate,
  insertStockMovement,
  listProducts as listProductsRepo,
  listReservations as listReservationsRepo,
  setProductStock,
  updateProduct as updateProductRepo,
  updateReservationStatus as updateReservationStatusRepo,
  type ProductRow,
  type ReservationRow,
} from './repository.js';

export interface Actor {
  id: string;
  role: 'atleta' | 'dm' | 'gestao';
}

export function listProducts(actor: Actor | undefined): Promise<ProductRow[]> {
  const publicOnly = !actor || actor.role !== 'gestao';
  return listProductsRepo(db, publicOnly);
}

export function createProduct(
  values: Pick<
    ProductRow,
    'name' | 'description' | 'priceCents' | 'imageUrl' | 'stock' | 'active' | 'featured'
  >,
) {
  return createProductRepo(db, values);
}

export async function updateProduct(
  id: string,
  values: Partial<
    Pick<ProductRow, 'name' | 'description' | 'priceCents' | 'imageUrl' | 'active' | 'featured'>
  >,
): Promise<ProductRow> {
  const existing = await findProductById(db, id);
  if (!existing) throw new NotFoundError('Product');
  return updateProductRepo(db, id, values);
}

// The concurrency-safe path: locks the product row for the duration of the
// transaction, so two simultaneous reservations for the last unit can't both
// read stock=1 and both succeed — the second one blocks until the first
// commits, then sees the updated (now zero) stock and is rejected.
export async function createReservation(params: {
  actor: Actor;
  productId: string;
  quantity: number;
  contactName: string;
  contactPhone: string;
  note?: string;
}): Promise<ReservationRow> {
  return db.transaction(async (tx) => {
    const product = await findProductForUpdate(tx, params.productId);
    if (!product || !product.active) throw new NotFoundError('Product');
    if (product.stock < params.quantity) {
      throw new ConflictError('Not enough stock available');
    }

    const reservation = await createReservationRow(tx, {
      productId: params.productId,
      userId: params.actor.id,
      contactName: params.contactName,
      contactPhone: params.contactPhone,
      quantity: params.quantity,
      note: params.note ?? null,
    });

    await insertStockMovement(tx, {
      productId: params.productId,
      delta: -params.quantity,
      reason: 'reservation',
      referenceId: reservation.id,
      createdBy: params.actor.id,
    });
    await setProductStock(tx, params.productId, product.stock - params.quantity);

    await recordAudit(tx, {
      actorId: params.actor.id,
      action: 'STOCK_ADJUSTED',
      entity: 'products',
      entityId: params.productId,
      metadata: { delta: -params.quantity, reason: 'reservation', reservationId: reservation.id },
    });

    return reservation;
  });
}

const TERMINAL_STATUSES = new Set<ReservationRow['status']>(['cancelled', 'completed']);

export async function updateReservationStatus(params: {
  actor: Actor;
  reservationId: string;
  status: ReservationRow['status'];
}): Promise<ReservationRow> {
  if (params.actor.role !== 'gestao') throw new ForbiddenError();

  return db.transaction(async (tx) => {
    const reservation = await findReservationForUpdate(tx, params.reservationId);
    if (!reservation) throw new NotFoundError('Reservation');
    if (TERMINAL_STATUSES.has(reservation.status)) {
      throw new ConflictError('This reservation has already reached a final status');
    }

    // Cancelling returns the reserved stock; completing does not (it was
    // already committed to the reservation at creation time).
    if (params.status === 'cancelled') {
      const product = await findProductForUpdate(tx, reservation.productId);
      if (product) {
        await insertStockMovement(tx, {
          productId: reservation.productId,
          delta: reservation.quantity,
          reason: 'cancellation',
          referenceId: reservation.id,
          createdBy: params.actor.id,
        });
        await setProductStock(tx, reservation.productId, product.stock + reservation.quantity);
        await recordAudit(tx, {
          actorId: params.actor.id,
          action: 'STOCK_ADJUSTED',
          entity: 'products',
          entityId: reservation.productId,
          metadata: {
            delta: reservation.quantity,
            reason: 'cancellation',
            reservationId: reservation.id,
          },
        });
      }
    }

    const updated = await updateReservationStatusRepo(tx, reservation.id, params.status);

    await recordAudit(tx, {
      actorId: params.actor.id,
      action: 'RESERVATION_STATUS_CHANGED',
      entity: 'reservations',
      entityId: reservation.id,
      metadata: { from: reservation.status, to: params.status },
    });

    return updated;
  });
}

export function listReservations(actor: Actor): Promise<ReservationRow[]> {
  if (actor.role !== 'gestao') throw new ForbiddenError();
  return listReservationsRepo(db);
}
