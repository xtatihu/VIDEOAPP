import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MAX = 500;
const stores = new Map();

export function openHistory(root) {
  if (stores.has(root)) return stores.get(root);
  const file = path.join(root, "data", "history.json");
  let queue = Promise.resolve();

  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return Array.isArray(data.events) ? data.events : [];
    } catch (e) {
      return [];
    }
  }

  function write(events) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ events: events.slice(0, MAX) }, null, 2) + "\n");
  }

  function add(entry) {
    const job = queue.then(() => {
      const events = read();
      const row = {
        id: crypto.randomBytes(6).toString("hex"),
        at: new Date().toISOString(),
        kind: String((entry && entry.kind) || "note").slice(0, 40),
        title: String((entry && entry.title) || "Update").slice(0, 160),
        detail: String((entry && entry.detail) || "").slice(0, 500),
      };
      events.unshift(row);
      write(events);
      return row;
    });
    queue = job.then(() => {}, () => {});
    return job;
  }

  const api = { add, list: () => read() };
  stores.set(root, api);
  return api;
}
