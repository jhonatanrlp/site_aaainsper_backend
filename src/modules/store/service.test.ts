import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';

vi.mock('../../database/client.js', () => ({
  db: { transaction: vi.fn((cb: (tx: unknown) => unknown) => cb('tx')) },
}));
vi.mock('../audit/repository.js', () => ({ recordAudit: vi.fn() }));
vi.mock('./repository.js', () => ({
  findProductForUpdate: vi.fn(),
  findProductById: vi.fn(),
  createReservationRow: vi.fn(),
  insertStockMovement: vi.fn(),
  setProductStock: vi.fn(),
  findReservationForUpdate: vi.fn(),
  updateReservationStatus: vi.fn(),
  listReservations: vi.fn(),
}));

const { recordAudit } = await import('../audit/repository.js');
const {
  findProductForUpdate,
  createReservationRow,
  insertStockMovement,
  setProductStock,
  findReservationForUpdate,
  updateReservationStatus: updateReservationStatusRepo,
} = await import('./repository.js');
const { createReservation, updateReservationStatus, listReservations } =
  await import('./service.js');

describe('createReservation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a reservation for more units than are in stock', async () => {
    vi.mocked(findProductForUpdate).mockResolvedValue({
      id: 'p1',
      active: true,
      stock: 1,
    } as never);

    await expect(
      createReservation({
        actor: { id: 'u1', role: 'atleta' },
        productId: 'p1',
        quantity: 2,
        contactName: 'Jane',
        contactPhone: '11999999999',
      }),
    ).rejects.toThrow(ConflictError);
    expect(createReservationRow).not.toHaveBeenCalled();
  });

  it('rejects a reservation for an inactive product', async () => {
    vi.mocked(findProductForUpdate).mockResolvedValue({
      id: 'p1',
      active: false,
      stock: 5,
    } as never);

    await expect(
      createReservation({
        actor: { id: 'u1', role: 'atleta' },
        productId: 'p1',
        quantity: 1,
        contactName: 'Jane',
        contactPhone: '11999999999',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('decrements stock, records the ledger entry, and audit-logs it', async () => {
    vi.mocked(findProductForUpdate).mockResolvedValue({
      id: 'p1',
      active: true,
      stock: 5,
    } as never);
    vi.mocked(createReservationRow).mockResolvedValue({ id: 'r1', quantity: 2 } as never);

    await createReservation({
      actor: { id: 'u1', role: 'atleta' },
      productId: 'p1',
      quantity: 2,
      contactName: 'Jane',
      contactPhone: '11999999999',
    });

    expect(insertStockMovement).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({
        productId: 'p1',
        delta: -2,
        reason: 'reservation',
        referenceId: 'r1',
      }),
    );
    expect(setProductStock).toHaveBeenCalledWith('tx', 'p1', 3);
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ action: 'STOCK_ADJUSTED' }),
    );
  });

  it('takes a row lock on the product before reading stock (prevents the classic race: two concurrent reservations both reading stock=1)', async () => {
    vi.mocked(findProductForUpdate).mockResolvedValue({
      id: 'p1',
      active: true,
      stock: 1,
    } as never);
    vi.mocked(createReservationRow).mockResolvedValue({ id: 'r1', quantity: 1 } as never);

    await createReservation({
      actor: { id: 'u1', role: 'atleta' },
      productId: 'p1',
      quantity: 1,
      contactName: 'Jane',
      contactPhone: '11999999999',
    });

    expect(findProductForUpdate).toHaveBeenCalledWith('tx', 'p1');
  });
});

describe('updateReservationStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a non-gestão actor', async () => {
    await expect(
      updateReservationStatus({
        actor: { id: 'dm-1', role: 'dm' },
        reservationId: 'r1',
        status: 'confirmed',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects transitioning a reservation that already reached a terminal status', async () => {
    vi.mocked(findReservationForUpdate).mockResolvedValue({
      id: 'r1',
      status: 'cancelled',
      quantity: 1,
      productId: 'p1',
    } as never);

    await expect(
      updateReservationStatus({
        actor: { id: 'gestor-1', role: 'gestao' },
        reservationId: 'r1',
        status: 'confirmed',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('restores stock when cancelling a pending reservation', async () => {
    vi.mocked(findReservationForUpdate).mockResolvedValue({
      id: 'r1',
      status: 'pending',
      quantity: 3,
      productId: 'p1',
    } as never);
    vi.mocked(findProductForUpdate).mockResolvedValue({ id: 'p1', stock: 2 } as never);
    vi.mocked(updateReservationStatusRepo).mockResolvedValue({
      id: 'r1',
      status: 'cancelled',
    } as never);

    await updateReservationStatus({
      actor: { id: 'gestor-1', role: 'gestao' },
      reservationId: 'r1',
      status: 'cancelled',
    });

    expect(insertStockMovement).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ productId: 'p1', delta: 3, reason: 'cancellation' }),
    );
    expect(setProductStock).toHaveBeenCalledWith('tx', 'p1', 5);
  });

  it('does not touch stock when completing a reservation', async () => {
    vi.mocked(findReservationForUpdate).mockResolvedValue({
      id: 'r1',
      status: 'confirmed',
      quantity: 3,
      productId: 'p1',
    } as never);
    vi.mocked(updateReservationStatusRepo).mockResolvedValue({
      id: 'r1',
      status: 'completed',
    } as never);

    await updateReservationStatus({
      actor: { id: 'gestor-1', role: 'gestao' },
      reservationId: 'r1',
      status: 'completed',
    });

    expect(insertStockMovement).not.toHaveBeenCalled();
    expect(setProductStock).not.toHaveBeenCalled();
  });
});

describe('listReservations', () => {
  it('rejects non-gestão roles', () => {
    expect(() => listReservations({ id: 'dm-1', role: 'dm' })).toThrow(ForbiddenError);
  });
});
