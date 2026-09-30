import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_PASS = "Test123";
const MAX_BODY = 24 * 1024;
const MAX_VISITS = 300;

function clip(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
}

function num(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

function flag(value) {
  return value === true || value === 1 || value === "true";
}

function privateIp(ip) {
  const clean = String(ip || "").replace(/^::ffff:/, "");
  return (
    !clean ||
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    clean.startsWith("172.16.") ||
    clean.startsWith("172.17.") ||
    clean.startsWith("172.18.") ||
    clean.startsWith("172.19.") ||
    clean.startsWith("172.2") ||
    clean.startsWith("172.30.") ||
    clean.startsWith("172.31.") ||
    clean === "localhost"
  );
}

export function visitsApi(root) {
  const dir = path.join(root, "data");
  const visitFile = path.join(dir, "visits.json");
  const keyFile = path.join(dir, "visit.key");
  const authFile = path.join(dir, "admin-auth.json");
  let queue = Promise.resolve();

  function ensureDir() {
    fs.mkdirSync(dir, { recursive: true });
  }

  function key() {
    ensureDir();
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
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    return JSON.parse(plain);
  }

  function readStore() {
    try {
      const data = JSON.parse(fs.readFileSync(visitFile, "utf8"));
      return Array.isArray(data.records) ? data.records : [];
    } catch (e) {
      return [];
    }
  }

  function writeStore(records) {
    ensureDir();
    const trimmed = records.slice(-MAX_VISITS);
    fs.writeFileSync(visitFile, JSON.stringify({ records: trimmed }));
    try { fs.chmodSync(visitFile, 0o600); } catch (e) {}
  }

  function readAuth() {
    try {
      const data = JSON.parse(fs.readFileSync(authFile, "utf8"));
      if (data && data.salt && data.hash) return data;
    } catch (e) {}
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(DEFAULT_PASS, Buffer.from(salt, "hex"), 32).toString("hex");
    const auth = { salt, hash };
    ensureDir();
    fs.writeFileSync(authFile, JSON.stringify(auth));
    try { fs.chmodSync(authFile, 0o600); } catch (e) {}
    return auth;
  }

  function passwordOk(password) {
    const auth = readAuth();
    const actual = crypto.scryptSync(String(password || ""), Buffer.from(auth.salt, "hex"), 32);
    const stored = Buffer.from(auth.hash, "hex");
    if (actual.length !== stored.length) return false;
    return crypto.timingSafeEqual(actual, stored);
  }

  function setPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, Buffer.from(salt, "hex"), 32).toString("hex");
    ensureDir();
    fs.writeFileSync(authFile, JSON.stringify({ salt, hash }));
    try { fs.chmodSync(authFile, 0o600); } catch (e) {}
  }

  function loadVisits() {
    const out = [];
    readStore().forEach((record) => {
      try { out.push(decrypt(record)); } catch (e) {}
    });
    return out;
  }

  function saveVisits(visits) {
    writeStore(visits.map((visit) => encrypt(visit)));
  }

  function mutate(fn) {
    const job = queue.then(() => fn());
    queue = job.then(() => {}, () => {});
    return job;
  }

  function clientIp(req) {
    const cf = req.headers["cf-connecting-ip"];
    if (cf) return clip(String(cf).split(",")[0], 80);
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return clip(String(forwarded).split(",")[0], 80);
    return clip(req.socket && req.socket.remoteAddress, 80);
  }

  async function lookupGeo(ip) {
    const clean = String(ip || "").replace(/^::ffff:/, "");
    if (privateIp(clean)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    try {
      const res = await fetch("https://ipwho.is/" + encodeURIComponent(clean), { signal: ctrl.signal });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || data.success === false) return null;
      return {
        country: clip(data.country, 80),
        region: clip(data.region, 80),
        city: clip(data.city, 80),
        latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
        longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
        isp: clip(data.connection && data.connection.isp, 120),
      };
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function shape(body, req, previous, geo) {
    const now = new Date().toISOString();
    const visitorId = clip(body.visitorId, 80) || (previous && previous.visitorId) || crypto.randomBytes(8).toString("hex");
    const sessionId = clip(body.sessionId, 80) || (previous && previous.sessionId) || crypto.randomBytes(8).toString("hex");
    const ip = clientIp(req);
    const countryHeader = clip(req.headers["cf-ipcountry"], 8);
    const base = previous || {
      visitorId,
      sessionId,
      startedAt: now,
      identity: {},
      network: {},
      location: {},
      device: {},
      software: {},
      behavior: {},
    };
    const behavior = base.behavior || {};
    const location = Object.assign({}, base.location || {});
    if (geo) {
      if (geo.country) location.country = geo.country;
      if (geo.region) location.region = geo.region;
      if (geo.city) location.city = geo.city;
      if (geo.latitude != null) location.latitude = geo.latitude;
      if (geo.longitude != null) location.longitude = geo.longitude;
      if (geo.isp) location.isp = geo.isp;
    }
    if (!location.country && countryHeader && countryHeader !== "XX") location.country = countryHeader;
    location.timezone = clip(body.timezone, 80) || location.timezone || "";
    location.locale = clip(body.locale, 40) || location.locale || "";
    if (privateIp(ip) && !location.country) location.place = "Local network";

    return {
      visitorId,
      sessionId,
      startedAt: base.startedAt || now,
      updatedAt: now,
      identity: {
        visitorId,
        sessionId,
        visits: base.identity && base.identity.visits ? base.identity.visits : 1,
      },
      network: {
        ip,
        forwarded: clip(req.headers["x-forwarded-for"], 180),
        effectiveType: clip(body.effectiveType, 20) || (base.network && base.network.effectiveType) || "",
        downlink: body.downlink != null ? num(body.downlink, 1000) : (base.network && base.network.downlink) || 0,
        rtt: body.rtt != null ? num(body.rtt, 10000) : (base.network && base.network.rtt) || 0,
        saveData: body.saveData != null ? flag(body.saveData) : !!(base.network && base.network.saveData),
      },
      location,
      device: {
        platform: clip(body.platform, 80) || (base.device && base.device.platform) || "",
        vendor: clip(body.vendor, 80) || (base.device && base.device.vendor) || "",
        mobile: body.mobile != null ? flag(body.mobile) : !!(base.device && base.device.mobile),
        screen: clip(body.screen, 40) || (base.device && base.device.screen) || "",
        pixelRatio: body.pixelRatio != null ? num(body.pixelRatio, 8) : (base.device && base.device.pixelRatio) || 0,
        cores: body.cores != null ? num(body.cores, 128) : (base.device && base.device.cores) || 0,
        memory: body.memory != null ? num(body.memory, 128) : (base.device && base.device.memory) || 0,
        touch: body.touch != null ? flag(body.touch) : !!(base.device && base.device.touch),
        maxTouch: body.maxTouch != null ? num(body.maxTouch, 20) : (base.device && base.device.maxTouch) || 0,
      },
      software: {
        userAgent: clip(body.userAgent || req.headers["user-agent"], 300) || (base.software && base.software.userAgent) || "",
        brands: clip(body.brands, 180) || (base.software && base.software.brands) || "",
        language: clip(body.language, 40) || (base.software && base.software.language) || "",
        cookies: body.cookies != null ? flag(body.cookies) : base.software ? !!base.software.cookies : false,
        doNotTrack: clip(body.doNotTrack, 12) || (base.software && base.software.doNotTrack) || "",
      },
      behavior: {
        referrer: clip(body.referrer, 300) || behavior.referrer || "",
        path: clip(body.path, 180) || behavior.path || "/",
        visibleSeconds: Math.max(num(behavior.visibleSeconds, 86400), num(body.visibleSeconds, 86400)),
        maxScroll: Math.max(num(behavior.maxScroll, 100), num(body.maxScroll, 100)),
        downloadClicks: Math.max(num(behavior.downloadClicks, 1000), num(body.downloadClicks, 1000)),
        screenTaps: Math.max(num(behavior.screenTaps, 1000), num(body.screenTaps, 1000)),
        gateSeen: !!(behavior.gateSeen || flag(body.gateSeen)),
        played: !!(behavior.played || flag(body.played)),
      },
    };
  }

  function send(res, code, body) {
    res.statusCode = code;
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(body));
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY) {
          reject(new Error("too big"));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        if (!raw) return resolve({});
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
      req.on("error", reject);
    });
  }

  return {
    name: "visits-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url || "").split("?")[0];
        if (pathOnly !== "/api/visit" && pathOnly !== "/api/visits" && pathOnly !== "/api/admin-pass") return next();

        if (req.method === "POST" && pathOnly === "/api/visit") {
          readBody(req)
            .then(async (body) => {
              const ip = clientIp(req);
              const geo = await lookupGeo(ip);
              await mutate(() => {
                const visits = loadVisits();
                const sessionId = clip(body.sessionId, 80);
                const index = visits.findIndex((item) => item.sessionId === sessionId);
                const previous = index >= 0 ? visits[index] : null;
                const visitorId = clip(body.visitorId, 80);
                const visit = shape(body, req, previous, geo);
                if (!previous && visitorId) {
                  const prior = visits.filter((item) => item.visitorId === visitorId).length;
                  visit.identity.visits = prior + 1;
                }
                if (index >= 0) visits[index] = visit;
                else visits.push(visit);
                saveVisits(visits);
              });
              send(res, 200, { ok: true });
            })
            .catch(() => send(res, 400, { error: "Could not save that visit." }));
          return;
        }

        if (req.method === "GET" && pathOnly === "/api/visits") {
          if (!passwordOk(req.headers["x-admin-key"])) {
            send(res, 401, { error: "Wrong password." });
            return;
          }
          const visits = loadVisits().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
          send(res, 200, { visits });
          return;
        }

        if (req.method === "DELETE" && pathOnly === "/api/visits") {
          if (!passwordOk(req.headers["x-admin-key"])) {
            send(res, 401, { error: "Wrong password." });
            return;
          }
          mutate(() => saveVisits([])).then(() => send(res, 200, { visits: [] }));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/admin-pass") {
          readBody(req)
            .then((body) => {
              const oldP = String(body.old || "");
              const nextP = String(body.next || "");
              if (!passwordOk(oldP)) {
                send(res, 401, { error: "Current password is wrong." });
                return;
              }
              if (nextP.length < 4) {
                send(res, 400, { error: "The new password needs at least 4 characters." });
                return;
              }
              setPassword(nextP);
              send(res, 200, { ok: true });
            })
            .catch(() => send(res, 400, { error: "Could not update the password." }));
          return;
        }

        send(res, 405, { error: "Method not allowed" });
      });
    },
  };
}
