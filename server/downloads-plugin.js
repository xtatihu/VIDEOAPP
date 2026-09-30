import fs from "node:fs";
import path from "node:path";

const DEFAULT_COUNT = 4793;

export function downloadsApi(root) {
  const file = path.join(root, "data", "downloads.json");
  let queue = Promise.resolve();

  function readCount() {
    try {
      const n = Number(JSON.parse(fs.readFileSync(file, "utf8")).count);
      if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    } catch (e) {}
    return DEFAULT_COUNT;
  }

  function writeCount(n) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ count: n }) + "\n");
  }

  function mutate(fn) {
    const job = queue.then(() => {
      const next = fn(readCount());
      writeCount(next);
      return next;
    });
    queue = job.then(
      () => {},
      () => {}
    );
    return job;
  }

  return {
    name: "downloads-api",
    configureServer(server) {
      server.middlewares.use("/api/downloads", (req, res, next) => {
        if (req.method !== "GET" && req.method !== "POST") return next();
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");

        if (req.method === "GET") {
          res.end(JSON.stringify({ count: readCount() }));
          return;
        }

        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          let body = {};
          const raw = Buffer.concat(chunks).toString("utf8").trim();
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON" }));
              return;
            }
          }

          if (body.count != null) {
            const n = Number(body.count);
            if (!Number.isFinite(n) || n < 0) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Count must be 0 or more" }));
              return;
            }
            mutate(() => Math.floor(n)).then((count) => {
              res.end(JSON.stringify({ count }));
            });
            return;
          }

          mutate((current) => current + 1).then((count) => {
            res.end(JSON.stringify({ count }));
          });
        });
      });
    },
  };
}
