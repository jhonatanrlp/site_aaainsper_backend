import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors.js';
import {
  createProduct,
  createReservation,
  listProducts,
  listReservations,
  updateProduct,
  updateReservationStatus,
} from './service.js';
import {
  createProductSchema,
  createReservationSchema,
  updateProductSchema,
  updateReservationStatusSchema,
} from './schema.js';

function requireUser(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}

export async function listProductsController(request: FastifyRequest, reply: FastifyReply) {
  reply.send(await listProducts(request.user));
}

export async function createProductController(request: FastifyRequest, reply: FastifyReply) {
  const input = createProductSchema.parse(request.body);
  reply.status(201).send(
    await createProduct({
      ...input,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
    }),
  );
}

export async function updateProductController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const input = updateProductSchema.parse(request.body);
  reply.send(await updateProduct(id, input));
}

export async function listReservationsController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  reply.send(await listReservations(user));
}

export async function createReservationController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const input = createReservationSchema.parse(request.body);
  reply.status(201).send(await createReservation({ actor: user, ...input }));
}

export async function updateReservationStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  const { status } = updateReservationStatusSchema.parse(request.body);
  reply.send(await updateReservationStatus({ actor: user, reservationId: id, status }));
}
