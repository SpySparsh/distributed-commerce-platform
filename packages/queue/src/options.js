import { jobNames, queueNames } from "./names.js";
export const queueRouting = {
    [jobNames.sendEmail]: {
        queueName: queueNames.email,
        attempts: 5,
        backoffMs: 5_000
    },
    [jobNames.generateInvoice]: {
        queueName: queueNames.invoice,
        attempts: 3,
        backoffMs: 10_000
    },
    [jobNames.trackAnalytics]: {
        queueName: queueNames.analytics,
        attempts: 3,
        backoffMs: 2_000
    },
    [jobNames.retryPayment]: {
        queueName: queueNames.paymentRetry,
        attempts: 8,
        backoffMs: 30_000
    },
    [jobNames.syncStock]: {
        queueName: queueNames.stockSync,
        attempts: 5,
        backoffMs: 15_000
    },
    [jobNames.releaseExpiredInventoryReservations]: {
        queueName: queueNames.inventory,
        attempts: 5,
        backoffMs: 10_000
    },
    [jobNames.reconcileInventoryReservations]: {
        queueName: queueNames.inventory,
        attempts: 3,
        backoffMs: 30_000
    },
    [jobNames.indexProductSearchDocument]: {
        queueName: queueNames.search,
        attempts: 5,
        backoffMs: 5_000
    },
    [jobNames.deleteProductSearchDocument]: {
        queueName: queueNames.search,
        attempts: 5,
        backoffMs: 5_000
    },
    [jobNames.rebuildSearchIndex]: {
        queueName: queueNames.search,
        attempts: 3,
        backoffMs: 30_000
    },
    [jobNames.dispatchDomainEvent]: {
        queueName: queueNames.domainEvents,
        attempts: 8,
        backoffMs: 5_000
    },
    [jobNames.deadLetter]: {
        queueName: queueNames.deadLetter,
        attempts: 1,
        backoffMs: 0
    }
};
export const createJobOptions = (jobName, idempotencyKey) => {
    const routing = queueRouting[jobName];
    return {
        jobId: idempotencyKey,
        attempts: routing.attempts,
        backoff: {
            type: "exponential",
            delay: routing.backoffMs
        },
        removeOnComplete: {
            age: 60 * 60 * 24,
            count: 1_000
        },
        removeOnFail: false
    };
};
