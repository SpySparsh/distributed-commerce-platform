import { Prisma } from "@ecommerce/database";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { validateRequest, withRateLimit } from "../../http/validate.js";
import { getAuthenticatedTenantId, getAuthenticatedUserId, requirePermission } from "../auth/auth.middleware.js";
import { permissions } from "../auth/permissions.js";

const productReviewsParamsSchema = z.object({
  id: z.uuid()
});

const productReviewsQuerySchema = z.object({
  tenantId: z.uuid()
});

const reviewParamsSchema = z.object({
  id: z.uuid()
});

const createReviewBodySchema = z.object({
  productId: z.uuid(),
  orderId: z.uuid(),
  orderItemId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(160),
  comment: z.string().trim().min(1).max(2_000)
});

const moderateReviewBodySchema = z.object({
  status: z.enum(["approved", "rejected"])
});

const toReviewDto = (review: {
  readonly id: string;
  readonly userId: string;
  readonly productId: string;
  readonly orderId: string;
  readonly orderItemId: string;
  readonly rating: number;
  readonly title: string;
  readonly comment: string;
  readonly verifiedPurchase: boolean;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly user?: {
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly email: string;
  };
}) => ({
  id: review.id,
  userId: review.userId,
  productId: review.productId,
  orderId: review.orderId,
  orderItemId: review.orderItemId,
  rating: review.rating,
  title: review.title,
  comment: review.comment,
  verifiedPurchase: review.verifiedPurchase,
  status: review.status,
  reviewerName: review.user === undefined
    ? "Verified customer"
    : [review.user.firstName, review.user.lastName].filter(Boolean).join(" ") || review.user.email.split("@")[0],
  createdAt: review.createdAt.toISOString(),
  updatedAt: review.updatedAt.toISOString()
});

const recalculateProductRating = async (
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string
): Promise<void> => {
  const stats = await tx.review.aggregate({
    where: {
      tenantId,
      productId,
      status: "approved"
    },
    _avg: {
      rating: true
    },
    _count: {
      _all: true
    }
  });
  const averageRating = stats._avg.rating === null ? "0.00" : stats._avg.rating.toFixed(2);

  await tx.product.updateMany({
    where: {
      tenantId,
      id: productId
    },
    data: {
      averageRating,
      reviewCount: stats._count._all
    }
  });
};

const createError = (code: string, message: string, statusCode: number): Error =>
  Object.assign(new Error(message), { code, statusCode });

export const reviewRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/products/:id/reviews",
    {
      preHandler: [
        withRateLimit({ keyPrefix: "reviews:product:list", maxRequests: 300 }),
        validateRequest({ params: productReviewsParamsSchema, query: productReviewsQuerySchema })
      ]
    },
    async (request) => {
      const params = productReviewsParamsSchema.parse(request.params);
      const query = productReviewsQuerySchema.parse(request.query);
      const [product, reviews, breakdown] = await Promise.all([
        app.prisma.product.findFirst({
          where: {
            tenantId: query.tenantId,
            id: params.id,
            deletedAt: null
          },
          select: {
            averageRating: true,
            reviewCount: true
          }
        }),
        app.prisma.review.findMany({
          where: {
            tenantId: query.tenantId,
            productId: params.id,
            status: "approved"
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 50
        }),
        app.prisma.review.groupBy({
          by: ["rating"],
          where: {
            tenantId: query.tenantId,
            productId: params.id,
            status: "approved"
          },
          _count: {
            _all: true
          }
        })
      ]);

      return {
        ok: true,
        data: {
          averageRating: product?.averageRating.toString() ?? "0.00",
          reviewCount: product?.reviewCount ?? 0,
          reviews: reviews.map(toReviewDto),
          breakdown: [5, 4, 3, 2, 1].map((rating) => ({
            rating,
            count: breakdown.find((item) => item.rating === rating)?._count._all ?? 0
          }))
        }
      };
    }
  );

  app.post(
    "/reviews",
    {
      preHandler: [
        requirePermission(permissions.reviewsWrite),
        withRateLimit({ keyPrefix: "reviews:create", maxRequests: 30 }),
        validateRequest({ body: createReviewBodySchema })
      ]
    },
    async (request, reply) => {
      const tenantId = getAuthenticatedTenantId(request);
      const userId = getAuthenticatedUserId(request);
      const body = createReviewBodySchema.parse(request.body);

      try {
        const review = await app.prisma.$transaction(async (tx) => {
          const order = await tx.order.findFirst({
            where: {
              tenantId,
              id: body.orderId,
              userId,
              status: "fulfilled",
              deletedAt: null,
              payments: {
                some: {
                  tenantId,
                  status: "captured",
                  deletedAt: null
                }
              },
              items: {
                some: {
                  id: body.orderItemId,
                  productId: body.productId,
                  deletedAt: null
                }
              }
            },
            select: {
              id: true
            }
          });

          if (order === null) {
            throw createError(
              "REVIEW_DELIVERED_PURCHASE_REQUIRED",
              "You can review this product only after a paid order containing it has been delivered.",
              403
            );
          }

          const created = await tx.review.create({
            data: {
              tenantId,
              userId,
              productId: body.productId,
              orderId: body.orderId,
              orderItemId: body.orderItemId,
              rating: body.rating,
              title: body.title,
              comment: body.comment,
              verifiedPurchase: true,
              status: "approved"
            },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          });

          await recalculateProductRating(tx, tenantId, body.productId);
          return created;
        });

        await reply.status(201).send({
          ok: true,
          data: {
            review: toReviewDto(review)
          }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          await reply.status(409).send({
            ok: false,
            error: {
              code: "REVIEW_ALREADY_EXISTS",
              message: "This delivered order item has already been reviewed.",
              correlationId: request.correlationId
            }
          });
          return;
        }

        const typed = error as Error & { readonly code?: string; readonly statusCode?: number };

        if (typed.statusCode !== undefined) {
          await reply.status(typed.statusCode).send({
            ok: false,
            error: {
              code: typed.code ?? "REVIEW_NOT_ALLOWED",
              message: typed.message,
              correlationId: request.correlationId
            }
          });
          return;
        }

        throw error;
      }
    }
  );

  app.get(
    "/reviews",
    {
      preHandler: [
        requirePermission(permissions.reviewsModerate),
        withRateLimit({ keyPrefix: "reviews:admin:list", maxRequests: 120 })
      ]
    },
    async (request) => {
      const tenantId = getAuthenticatedTenantId(request);
      const reviews = await app.prisma.review.findMany({
        where: {
          tenantId
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 100
      });

      return {
        ok: true,
        data: {
          reviews: reviews.map(toReviewDto)
        }
      };
    }
  );

  app.delete(
    "/reviews/:id",
    {
      preHandler: [
        requirePermission(permissions.reviewsModerate),
        withRateLimit({ keyPrefix: "reviews:admin:delete", maxRequests: 60 }),
        validateRequest({ params: reviewParamsSchema })
      ]
    },
    async (request, reply) => {
      const tenantId = getAuthenticatedTenantId(request);
      const params = reviewParamsSchema.parse(request.params);
      const result = await app.prisma.$transaction(async (tx) => {
        const review = await tx.review.findFirst({
          where: {
            tenantId,
            id: params.id
          },
          select: {
            id: true,
            productId: true
          }
        });

        if (review === null) {
          return undefined;
        }

        await tx.review.delete({
          where: {
            id: review.id
          }
        });
        await recalculateProductRating(tx, tenantId, review.productId);
        return review;
      });

      if (result === undefined) {
        await reply.status(404).send({
          ok: false,
          error: {
            code: "REVIEW_NOT_FOUND",
            message: "Review not found",
            correlationId: request.correlationId
          }
        });
        return;
      }

      return {
        ok: true,
        data: {
          deleted: true
        }
      };
    }
  );

  app.patch(
    "/reviews/:id/moderate",
    {
      preHandler: [
        requirePermission(permissions.reviewsModerate),
        withRateLimit({ keyPrefix: "reviews:admin:moderate", maxRequests: 60 }),
        validateRequest({ params: reviewParamsSchema, body: moderateReviewBodySchema })
      ]
    },
    async (request, reply) => {
      const tenantId = getAuthenticatedTenantId(request);
      const params = reviewParamsSchema.parse(request.params);
      const body = moderateReviewBodySchema.parse(request.body);
      const review = await app.prisma.$transaction(async (tx) => {
        const existing = await tx.review.findFirst({
          where: {
            tenantId,
            id: params.id
          }
        });

        if (existing === null) {
          return undefined;
        }

        const updated = await tx.review.update({
          where: {
            id: existing.id
          },
          data: {
            status: body.status
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        });
        await recalculateProductRating(tx, tenantId, existing.productId);
        return updated;
      });

      if (review === undefined) {
        await reply.status(404).send({
          ok: false,
          error: {
            code: "REVIEW_NOT_FOUND",
            message: "Review not found",
            correlationId: request.correlationId
          }
        });
        return;
      }

      return {
        ok: true,
        data: {
          review: toReviewDto(review)
        }
      };
    }
  );
};
