import mongoose from "mongoose";
import { getServerEnv } from "./env";

export interface DatabaseConfig {
  readonly uri: string;
}

export interface DatabaseConnectionResult {
  readonly databaseName: string;
  readonly readyState: mongoose.ConnectionStates;
}

export class DatabaseConnectionError extends Error {
  override name = "DatabaseConnectionError";
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

const createDatabaseConfig = (): DatabaseConfig => {
  const env = getServerEnv();

  if (env.MONGO_URI === undefined) {
    throw new DatabaseConnectionError("MONGO_URI is required to connect to MongoDB.");
  }

  return {
    uri: env.MONGO_URI
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown database connection error";
};

export const connectDB = async (
  config: DatabaseConfig = createDatabaseConfig()
): Promise<DatabaseConnectionResult> => {
  try {
    const connection = await mongoose.connect(config.uri);
    const databaseName = connection.connection.name;

    console.log("Connected to DB:", databaseName);

    return {
      databaseName,
      readyState: connection.connection.readyState
    };
  } catch (error: unknown) {
    throw new DatabaseConnectionError(
      `MongoDB connection failed: ${getErrorMessage(error)}`,
      error
    );
  }
};

export default connectDB;
