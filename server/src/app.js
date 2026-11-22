import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import expensesRoutes from "./routes/expenses.routes.js";
import groupsRoutes from "./routes/groups.routes.js";

export const app = express();

// Trust proxy for rate limiting behind reverse proxies
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// Global rate limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === "test" ? 10000 : 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test"
  })
);

// Health check
app.get("/api/health", (_request, response) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  response.status(200).json({
    status: "ok",
    db: states[mongoose.connection.readyState] ?? "unknown",
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/groups", groupsRoutes);

// 404 fallback
app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

// Error handler
app.use(errorHandler);
