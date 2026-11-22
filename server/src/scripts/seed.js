import mongoose from "mongoose";
import { env } from "../config/env.js";
import { ensureDemoData } from "../services/demoSeed.js";

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected.");

  console.log("Seeding demo data...");
  const demoUser = await ensureDemoData();
  console.log(`Demo user created/updated: ${demoUser.email}`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
