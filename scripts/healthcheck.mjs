import net from "node:net";

const timeoutMs = 3_000;
const retryCount = 30;
const retryDelayMs = 2_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestJson = async (url) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.json();
};

const requestText = async (url) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.text();
};

const pingRedis = () =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: 6379 });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Redis ping timed out"));
    }, timeoutMs);

    socket.once("connect", () => {
      socket.write("*1\r\n$4\r\nPING\r\n");
    });

    socket.once("data", (data) => {
      clearTimeout(timer);
      socket.end();

      if (data.toString().includes("PONG")) {
        resolve();
        return;
      }

      reject(new Error(`Unexpected Redis response: ${data.toString().trim()}`));
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

const checks = [
  {
    name: "frontend",
    run: async () => {
      await requestText("http://localhost:3000");
    }
  },
  {
    name: "backend",
    run: async () => {
      const health = await requestJson("http://localhost:4000/health");

      if (health.status !== "ok") {
        throw new Error(`Unexpected API health status: ${health.status}`);
      }
    }
  },
  {
    name: "prisma database via API readiness",
    run: async () => {
      const readiness = await requestJson("http://localhost:4000/health/ready");

      if (readiness.status !== "ready" || readiness.dependencies?.database !== "up") {
        throw new Error(`Database is not ready: ${JSON.stringify(readiness)}`);
      }
    }
  },
  {
    name: "email service",
    run: async () => {
      const health = await requestJson("http://localhost:4100/health");

      if (health.service !== "email-service") {
        throw new Error(`Unexpected email service health response: ${JSON.stringify(health)}`);
      }
    }
  },
  {
    name: "redis",
    run: pingRedis
  },
  {
    name: "meilisearch",
    run: async () => {
      const health = await requestJson("http://localhost:7700/health");

      if (health.status !== "available") {
        throw new Error(`Unexpected Meilisearch status: ${health.status}`);
      }
    }
  }
];

const waitForCheck = async (check) => {
  let lastError;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      await check.run();
      console.log(`[health:ok] ${check.name}`);
      return;
    } catch (error) {
      lastError = error;
      await sleep(retryDelayMs);
    }
  }

  throw new Error(`${check.name} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
};

for (const check of checks) {
  await waitForCheck(check);
}

console.log("[health:ok] Local stack is operational.");
