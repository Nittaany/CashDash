import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.js"],
    hookTimeout: 60000,
    testTimeout: 30000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      PORT: "3001",
      MONGODB_URI: "mongodb://localhost:27017/cashdash-test",
      JWT_ACCESS_SECRET: "test-access-secret-at-least-32-characters-long",
      JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-characters-long",
      CLIENT_URL: "http://localhost:3000"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.js"],
      exclude: ["src/scripts/**", "src/server.js"]
    }
  }
});
