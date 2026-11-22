import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { env } from "./config/env.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

app.get("/api/health", (_request, response) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  response.status(200).json({
    status: "ok",
    db: states[mongoose.connection.readyState] ?? "unknown",
    uptimeSeconds: Math.floor(process.uptime())
  });
});

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

app.use((error, _request, response, _next) => {
  const status = error.status ?? 500;
  response.status(status).json({
    error: env.NODE_ENV === "production" ? "Internal server error" : error.message
  });
});
