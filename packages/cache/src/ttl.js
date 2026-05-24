export const cacheTtl = {
    product: {
        freshSeconds: 60,
        staleSeconds: 300
    },
    category: {
        freshSeconds: 300,
        staleSeconds: 900
    },
    hotProducts: {
        freshSeconds: 30,
        staleSeconds: 120
    },
    cart: {
        freshSeconds: 60 * 60 * 24 * 30,
        staleSeconds: 0
    },
    inventoryLock: {
        freshSeconds: 15,
        staleSeconds: 0
    }
};
