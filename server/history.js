import path from "node:path";
import crypto from "node:crypto";
import { openBox } from "./secret-box.js";

const MAX = 500;
const stores = new Map();

export function openHistory(root) {
  if (stores.has(root)) return stores.get(root);
  const file = path.join(root, "data", "history.json");
  const box = openBox(root);
  let queue = Promise.resolve();

  function read() {
    const loaded = box.readJsonFile(file, { events: [] });
    if (loaded.error) throw new Error("Could not read history.");
    const events = Array.isArray(loaded.value) ? loaded.value : (loaded.value && loaded.value.events) || [];
    if (loaded.plain && !loaded.missing) box.writeJsonFile(file, { events });
    return events;
  }

  function write(events) {
    box.writeJsonFile(file, { events: events.slice(0, MAX) });
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

  function remove(id) {
    const job = queue.then(() => {
      const events = read().filter((row) => row.id !== id);
      write(events);
      return events;
    });
    queue = job.then(() => {}, () => {});
    return job;
  }

  function clear() {
    const job = queue.then(() => {
      write([]);
      return [];
    });
    queue = job.then(() => {}, () => {});
    return job;
  }

  const api = { add, list: () => read(), remove, clear };
  stores.set(root, api);
  return api;
}
