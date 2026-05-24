import pino, {} from "pino";
export const redactionPaths = [
    "req.headers.authorization",
    "req.headers.cookie",
    "request.headers.authorization",
    "request.headers.cookie",
    "*.password",
    "*.passwordHash",
    "*.accessToken",
    "*.refreshToken"
];
export const createPinoOptions = ({ serviceName, environment, level }) => ({
    level,
    base: {
        service: serviceName,
        environment
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: [...redactionPaths],
        remove: true
    },
    formatters: {
        level(label) {
            return {
                level: label
            };
        }
    }
});
export const createServiceLogger = (options) => pino(createPinoOptions(options));
