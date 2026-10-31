import mongoose from "mongoose";
import { Router } from "express";
import { getSettings } from "../config";

export const healthRouter = Router();

/**
 * A health check that always says "ok" is a liar. Report 200 only when MongoDB
 * actually answers a ping; otherwise 503 so load balancers and smoke tests notice.
 */
healthRouter.get("/api/health", async (_req, res) => {
  let db: "ok" | "down" = "down";
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      db = "ok";
    }
  } catch {
    db = "down";
  }
  res.status(db === "ok" ? 200 : 503).json({
    status: db === "ok" ? "ok" : "error",
    version: getSettings().APP_VERSION,
    db,
  });
});
