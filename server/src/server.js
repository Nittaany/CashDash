import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";

let server;

async function start() {
  await mongoose.connect(env.MONGODB_URI);

  server = app.listen(env.PORT, () => {
    console.log(`CashDash server listening on port ${env.PORT}`);
  });
}

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down gracefully...`);

  if (server) {
    server.close(() => {
      console.log("HTTP server closed");
    });
  }

  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (process.env.NODE_ENV !== "test") {
  start().catch((error) => {
    console.error("Failed to start CashDash server:", error);
    process.exit(1);
  });
}
