import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const boxes = new Map();

export function openBox(root) {
  if (boxes.has(root)) return boxes.get(root);
  const keyFile = path.join(root, "data", "visit.key");

  function key() {
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    if (!fs.existsSync(keyFile)) {
      fs.writeFileSync(keyFile, crypto.randomBytes(32));
      try { fs.chmodSync(keyFile, 0o600); } catch (e) {}
    }
    const raw = fs.readFileSync(keyFile);
    return raw.length >= 32 ? raw.subarray(0, 32) : crypto.createHash("sha256").update(raw).digest();
  }

  function encrypt(obj) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
  }

  function decrypt(payload) {
    const buf = Buffer.from(String(payload || ""), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8"));
  }

  function readJsonFile(file, fallback) {
    try {
      if (!fs.existsSync(file)) return { value: fallback, plain: false, missing: true };
      const raw = fs.readFileSync(file, "utf8").trim();
      if (!raw) return { value: fallback, plain: false, missing: true };
      if (raw.startsWith("{") || raw.startsWith("[")) return { value: JSON.parse(raw), plain: true };
      return { value: decrypt(raw), plain: false };
    } catch (e) {
      return { value: fallback, plain: false, error: true };
    }
  }

  function writeJsonFile(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encrypt(value));
    try { fs.chmodSync(file, 0o600); } catch (e) {}
  }

  const api = { encrypt, decrypt, readJsonFile, writeJsonFile };
  boxes.set(root, api);
  return api;
}
