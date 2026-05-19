import bcrypt from "bcryptjs";

const PASSWORD_COST = 12;

export const hashPassword = async (password: string): Promise<string> =>
  bcrypt.hash(password, PASSWORD_COST);

export const verifyPassword = async (password: string, passwordHash: string): Promise<boolean> =>
  bcrypt.compare(password, passwordHash);
