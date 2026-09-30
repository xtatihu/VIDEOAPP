import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import QRCode from "qrcode";

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

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str || "").toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  let n = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 1000000).padStart(6, "0");
}

function totpOk(secretB32, code) {
  const token = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  const secret = base32Decode(secretB32);
  if (secret.length < 10) return false;
  const step = Math.floor(Date.now() / 30000);
  const given = Buffer.from(token);
  for (let i = -1; i <= 1; i++) {
    const expect = Buffer.from(hotp(secret, step + i));
    if (expect.length === given.length && crypto.timingSafeEqual(expect, given)) return true;
  }
  return false;
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

  const sessions = new Map();

  function issueSession() {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
    return token;
  }

  function sessionOk(token) {
    const key = String(token || "");
    const expires = sessions.get(key);
    if (!expires) return false;
    if (Date.now() > expires) {
      sessions.delete(key);
      return false;
    }
    return true;
  }

  function authorized(req) {
    return passwordOk(req.headers["x-admin-key"]) || sessionOk(req.headers["x-admin-session"]);
  }

  function readGoogle() {
    const auth = readAuth();
    return {
      clientId: clip(auth.googleClientId, 200),
      email: clip(auth.googleEmail, 120).toLowerCase(),
    };
  }

  function saveGoogle(clientId, email) {
    const auth = readAuth();
    auth.googleClientId = clip(clientId, 200);
    auth.googleEmail = clip(email, 120).toLowerCase();
    ensureDir();
    fs.writeFileSync(authFile, JSON.stringify(auth));
    try { fs.chmodSync(authFile, 0o600); } catch (e) {}
  }

  function readOtp() {
    const auth = readAuth();
    let secret = "";
    let pending = "";
    try { if (auth.otpSecret) secret = String(decrypt(auth.otpSecret).secret || ""); } catch (e) {}
    try { if (auth.otpPending) pending = String(decrypt(auth.otpPending).secret || ""); } catch (e) {}
    return { enabled: auth.otpEnabled === true && !!secret, secret, pending };
  }

  function writeOtp(patch) {
    const auth = readAuth();
    if (Object.prototype.hasOwnProperty.call(patch, "enabled")) auth.otpEnabled = patch.enabled === true;
    if (Object.prototype.hasOwnProperty.call(patch, "secret")) auth.otpSecret = patch.secret ? encrypt({ secret: patch.secret }) : "";
    if (Object.prototype.hasOwnProperty.call(patch, "pending")) auth.otpPending = patch.pending ? encrypt({ secret: patch.pending }) : "";
    ensureDir();
    fs.writeFileSync(authFile, JSON.stringify(auth));
    try { fs.chmodSync(authFile, 0o600); } catch (e) {}
  }

  function otpGate(body) {
    const otp = readOtp();
    if (!otp.enabled) return null;
    const code = String((body && body.otp) || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) {
      return { needsOtp: true, error: "Enter the 6-digit code from Google Authenticator." };
    }
    if (!totpOk(otp.secret, code)) {
      return { needsOtp: true, error: "That Authenticator code is wrong." };
    }
    return null;
  }

  function setPassword(password) {
    const prev = readAuth();
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, Buffer.from(salt, "hex"), 32).toString("hex");
    ensureDir();
    fs.writeFileSync(authFile, JSON.stringify({
      salt,
      hash,
      googleClientId: prev.googleClientId || "",
      googleEmail: prev.googleEmail || "",
      otpEnabled: prev.otpEnabled === true,
      otpSecret: prev.otpSecret || "",
      otpPending: prev.otpPending || "",
    }));
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

  async function fetchJson(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function vpnLabel(info) {
    if (!info) return "";
    if (info.proxy) return "Yes (Proxy)";
    if (info.hosting) return "Yes (Datacenter / VPN)";
    if (info.mobile) return "No (Normal Mobile Network)";
    return "No (Normal network)";
  }

  async function lookupGeo(ip) {
    const clean = String(ip || "").replace(/^::ffff:/, "");
    if (privateIp(clean)) return null;
    const primary = await fetchJson(
      "http://ip-api.com/json/" + encodeURIComponent(clean) + "?fields=status,country,regionName,city,zip,lat,lon,timezone,offset,isp,mobile,proxy,hosting"
    );
    if (primary && primary.status === "success") {
      return {
        country: clip(primary.country, 80),
        region: clip(primary.regionName, 80),
        city: clip(primary.city, 80),
        zip: clip(primary.zip, 16),
        latitude: Number.isFinite(Number(primary.lat)) ? Number(primary.lat) : null,
        longitude: Number.isFinite(Number(primary.lon)) ? Number(primary.lon) : null,
        isp: clip(primary.isp, 120),
        timezone: clip(primary.timezone, 80),
        vpn: vpnLabel(primary),
      };
    }
    const data = await fetchJson("https://ipwho.is/" + encodeURIComponent(clean));
    if (!data || data.success === false) return null;
    return {
      country: clip(data.country, 80),
      region: clip(data.region, 80),
      city: clip(data.city, 80),
      zip: clip(data.postal, 16),
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      isp: clip(data.connection && data.connection.isp, 120),
      timezone: clip(data.timezone && data.timezone.id, 80),
      vpn: "",
    };
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
      if (geo.zip) location.zip = geo.zip;
      if (geo.vpn) location.vpn = geo.vpn;
      if (geo.timezone) location.geoTimezone = geo.timezone;
    }
    if (!location.country && countryHeader && countryHeader !== "XX") location.country = countryHeader;
    location.timezone = clip(body.timezone, 80) || location.timezone || location.geoTimezone || "";
    location.gmt = clip(body.gmt, 16) || location.gmt || "";
    location.locale = clip(body.locale, 40) || location.locale || "";
    if (privateIp(ip) && !location.country) {
      location.place = "Local network";
      if (!location.vpn) location.vpn = "No (Local network)";
    }

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
        isp: (geo && geo.isp) || (base.network && base.network.isp) || location.isp || "",
        vpn: (geo && geo.vpn) || location.vpn || (base.network && base.network.vpn) || "",
        connectionType: clip(body.connectionType, 40) || (base.network && base.network.connectionType) || "",
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
        category: clip(body.category, 40) || (base.device && base.device.category) || "",
        os: clip(body.os, 40) || (base.device && base.device.os) || "",
        model: clip(body.model, 80) || (base.device && base.device.model) || "",
        battery: body.battery == null || body.battery === "" ? (base.device && base.device.battery != null ? base.device.battery : null) : num(body.battery, 100),
        charging: body.charging == null || body.charging === "" ? !!(base.device && base.device.charging) : flag(body.charging),
      },
      software: {
        userAgent: clip(body.userAgent || req.headers["user-agent"], 400) || (base.software && base.software.userAgent) || "",
        brands: clip(body.brands, 180) || (base.software && base.software.brands) || "",
        language: clip(body.language, 40) || (base.software && base.software.language) || "",
        languages: clip(body.languages, 120) || (base.software && base.software.languages) || "",
        browser: clip(body.browser, 60) || (base.software && base.software.browser) || "",
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
        left: flag(body.left),
        clicks: clip(body.clicks, 240) || behavior.clicks || "",
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
        const otpPath = pathOnly === "/api/otp-status" || pathOnly === "/api/otp/setup" || pathOnly === "/api/otp/confirm" || pathOnly === "/api/otp/disable";
        if (pathOnly !== "/api/visit" && pathOnly !== "/api/visits" && pathOnly !== "/api/admin-pass" && pathOnly !== "/api/login" && pathOnly !== "/api/google-config" && pathOnly !== "/api/google-login" && !otpPath) return next();

        if (req.method === "POST" && pathOnly === "/api/visit") {
          readBody(req)
            .then(async (body) => {
              const ip = clientIp(req);
              const sessionId = clip(body.sessionId, 80);
              const existing = sessionId ? loadVisits().find((item) => item.sessionId === sessionId) : null;
              const geo = existing && existing.location && (existing.location.country || existing.location.vpn) ? null : await lookupGeo(ip);
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

        if (req.method === "POST" && pathOnly === "/api/login") {
          readBody(req)
            .then((body) => {
              if (!passwordOk(body.password)) {
                send(res, 401, { error: "Wrong password." });
                return;
              }
              const blocked = otpGate(body);
              if (blocked) {
                send(res, 401, blocked);
                return;
              }
              send(res, 200, { session: issueSession() });
            })
            .catch(() => send(res, 400, { error: "Could not sign in." }));
          return;
        }

        if (req.method === "GET" && pathOnly === "/api/otp-status") {
          send(res, 200, { enabled: readOtp().enabled });
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/otp/setup") {
          if (!authorized(req)) {
            send(res, 401, { error: "Wrong password." });
            return;
          }
          const secret = base32Encode(crypto.randomBytes(20));
          const uri = "otpauth://totp/" + encodeURIComponent("VideoApp Admin") + "?secret=" + secret + "&issuer=" + encodeURIComponent("VideoApp") + "&digits=6&period=30";
          writeOtp({ pending: secret });
          QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: "M" })
            .then((qr) => send(res, 200, { secret, uri, qr }))
            .catch(() => send(res, 200, { secret, uri, qr: "" }));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/otp/confirm") {
          if (!authorized(req)) {
            send(res, 401, { error: "Wrong password." });
            return;
          }
          readBody(req)
            .then((body) => {
              const otp = readOtp();
              if (!otp.pending) {
                send(res, 400, { error: "Set up Authenticator first." });
                return;
              }
              if (!totpOk(otp.pending, body.code)) {
                send(res, 401, { error: "That code does not match. Check the time on your phone and try the new code." });
                return;
              }
              writeOtp({ enabled: true, secret: otp.pending, pending: "" });
              send(res, 200, { enabled: true });
            })
            .catch(() => send(res, 400, { error: "Could not turn on Authenticator." }));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/otp/disable") {
          if (!authorized(req)) {
            send(res, 401, { error: "Wrong password." });
            return;
          }
          readBody(req)
            .then((body) => {
              const otp = readOtp();
              if (otp.enabled && !totpOk(otp.secret, body.code)) {
                send(res, 401, { error: "That Authenticator code is wrong." });
                return;
              }
              writeOtp({ enabled: false, secret: "", pending: "" });
              send(res, 200, { enabled: false });
            })
            .catch(() => send(res, 400, { error: "Could not turn off Authenticator." }));
          return;
        }

        if (req.method === "GET" && pathOnly === "/api/google-config") {
          const google = readGoogle();
          if (authorized(req)) send(res, 200, google);
          else send(res, 200, { clientId: google.clientId });
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/google-config") {
          if (!authorized(req)) {
            send(res, 401, { error: "Wrong password." });
            return;
          }
          readBody(req)
            .then((body) => {
              const clientId = clip(body.clientId, 200);
              const email = clip(body.email, 120).toLowerCase();
              if (clientId && !clientId.endsWith(".apps.googleusercontent.com")) {
                send(res, 400, { error: "Paste the Web client ID from Google Cloud." });
                return;
              }
              if (email && !email.includes("@")) {
                send(res, 400, { error: "Enter the Gmail address that may open admin." });
                return;
              }
              saveGoogle(clientId, email);
              send(res, 200, { clientId, email });
            })
            .catch(() => send(res, 400, { error: "Could not save Google sign-in." }));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/google-login") {
          readBody(req)
            .then(async (body) => {
              const blocked = otpGate(body);
              if (blocked) {
                send(res, 401, blocked);
                return;
              }
              const google = readGoogle();
              if (!google.clientId || !google.email) {
                send(res, 400, { error: "Save a Google Client ID and Gmail in the Password section first." });
                return;
              }
              const credential = String(body.credential || "");
              if (!credential || credential.length > 4000) {
                send(res, 401, { error: "Google sign-in failed." });
                return;
              }
              const info = await fetchJson("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
              const verified = info && (info.email_verified === true || info.email_verified === "true");
              if (!info || info.aud !== google.clientId || !verified || clip(info.email, 120).toLowerCase() !== google.email) {
                send(res, 401, { error: "This Google account cannot open the admin." });
                return;
              }
              send(res, 200, { session: issueSession(), email: google.email });
            })
            .catch(() => send(res, 401, { error: "Google sign-in failed." }));
          return;
        }

        if (req.method === "GET" && pathOnly === "/api/visits") {
          if (!authorized(req)) {
            send(res, 401, { error: "Wrong password." });
            return;
          }
          const visits = loadVisits().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
          send(res, 200, { visits });
          return;
        }

        if (req.method === "DELETE" && pathOnly === "/api/visits") {
          if (!authorized(req)) {
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
