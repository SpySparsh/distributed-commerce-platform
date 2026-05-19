export class AuthError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const invalidCredentialsError = (): AuthError =>
  new AuthError("INVALID_CREDENTIALS", "Invalid email or password", 401);

export const invalidSessionError = (): AuthError =>
  new AuthError("INVALID_SESSION", "Session is invalid or expired", 401);

export const forbiddenError = (): AuthError =>
  new AuthError("FORBIDDEN", "You do not have permission to access this resource", 403);
