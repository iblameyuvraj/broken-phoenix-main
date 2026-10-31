import mongoose from "mongoose";
import { ALL_MODELS } from "./models";

mongoose.set("strictQuery", true);

let connecting: Promise<void> | null = null;

/**
 * Connect the default mongoose connection - the one every model is registered on.
 * Safe to call more than once: the pending/established connection is reused, which is
 * what serverless invocations and the test setup need.
 */
export async function connectDb(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (!connecting) {
    connecting = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10_000 })
      .then(() => {
        // Unique indexes (workspace members, ledger idempotency keys) are promises
        // only if they really exist in MongoDB.
        return Promise.all(ALL_MODELS.map((m) => m.init()));
      })
      .then(() => undefined)
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }
  await connecting;
}

export async function disconnectDb(): Promise<void> {
  connecting = null;
  await mongoose.disconnect();
}
