import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";

async function start() {
  await mongoose.connect(env.MONGODB_URI);

  app.listen(env.PORT, () => {
    console.log(`CashDash server listening on port ${env.PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch((error) => {
    console.error("Failed to start CashDash server:", error);
    process.exit(1);
  });
}
