import path from "node:path";
import { openHistory } from "./history.js";
import { openBox } from "./secret-box.js";

const DEFAULT_COUNT = 4793;

export function downloadsApi(root) {
  const file = path.join(root, "data", "downloads.json");
  const history = openHistory(root);
  const box = openBox(root);
  let queue = Promise.resolve();

  function readCount() {
    const loaded = box.readJsonFile(file, { count: DEFAULT_COUNT });
    if (loaded.error) throw new Error("Could not read the download count.");
    const n = Number(loaded.value && loaded.value.count);
    const count = Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_COUNT;
    if (loaded.plain && !loaded.missing) writeCount(count);
    return count;
  }

  function writeCount(n) {
    box.writeJsonFile(file, { count: n });
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
              history.add({ kind: "download", title: "Download count saved", detail: "The landing page count is now " + count + "." });
              res.end(JSON.stringify({ count }));
            });
            return;
          }

          mutate((current) => current + 1).then((count) => {
            history.add({ kind: "download", title: "APK downloaded", detail: "Someone downloaded the APK from the landing page. Count is now " + count + "." });
            res.end(JSON.stringify({ count }));
          });
        });
      });
    },
  };
}
