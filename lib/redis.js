import { Redis } from "@upstash/redis";
import dotenv from "dotenv";
dotenv.config();

// Log connection status
console.log("🔍 Connecting to Redis via REST at", process.env.UPSTASH_REDIS_REST_URL ? "Upstash" : "undefined URL");

// Custom mock class
class RedisMock {
  constructor() {
    this.store = new Map();
    this.isMock = true;
    console.warn("⚠️ Using Redis mock - data will not persist between restarts");
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async set(key, value, options = {}) {
    this.store.set(key, value);
    return "OK";
  }

  async del(key) {
    this.store.delete(key);
    return 1;
  }

  async ping() {
    return "PONG";
  }
}

// Initialize redis client
let redis;

const isProd = process.env.NODE_ENV === "production";
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  if (isProd) {
    throw new Error("MISSING REDIS ENV: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production");
  }
  console.warn("⚠️ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in .env — using Redis mock");
  redis = new RedisMock();
} else {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Optional: check ping
    const pong = await redis.ping();
    console.log("✅ Redis ping:", pong);
  } catch (err) {
    console.error("❌ Redis connection failed:", err.message);
    console.warn("⚠️ Falling back to Redis mock");
    redis = new RedisMock();
  }
}

export { redis };
