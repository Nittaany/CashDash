import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      PORT: "3001",
      MONGODB_URI: "mongodb://127.0.0.1:27017/cashdash-test",
      JWT_ACCESS_SECRET: "test-access-secret-at-least-32-characters",
      JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-characters",
      CLIENT_URL: "http://localhost:3000",
      NODE_ENV: "test"
    }
  }
});
