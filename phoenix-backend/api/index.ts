import type { Request, Response } from "express";
import { createApp } from "../src/app";
import { getSettings } from "../src/config";
import { connectDb } from "../src/db";

// Serverless invocations come and go; the app and the database connection are built
// once per warm lambda and reused.
let app: ReturnType<typeof createApp> | null = null;
let connecting: Promise<void> | null = null;

export default async function handler(req: Request, res: Response) {
  const expressApp = (app ??= createApp());
  connecting ??= connectDb(getSettings().MONGODB_URI).catch((err) => {
    connecting = null;
    throw err;
  });
  await connecting;
  // Never app.listen() here: a cloud function is not a server that waits by the phone.
  return expressApp(req, res);
}
