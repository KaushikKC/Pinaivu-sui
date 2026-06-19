import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true });
redis.on("error", (e) => console.warn("[redis]", e.message));
await redis.connect().catch(() => {});

export default redis;
