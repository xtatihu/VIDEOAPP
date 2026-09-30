import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Busboy from "busboy";
import { openHistory } from "./history.js";

const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v"]);
const APK_EXT = new Set([".apk"]);
const MAX_BYTES = 200 * 1024 * 1024;

function emptyLib() {
  return { apks: [], activeApkId: "", videos: [], nextIndex: 0, nextApkIndex: 0, schedule: null };
}

export function libraryApi(root) {
  const file = path.join(root, "data", "library.json");
  const uploadDir = path.join(root, "public", "uploads");
  let queue = Promise.resolve();

  function readLib() {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      let apks = Array.isArray(data.apks) ? data.apks.filter((item) => item && item.url) : [];
      if (!apks.length && data.apk && data.apk.url) apks = [data.apk];
      apks = apks.map((item) => ({
        id: item.id || newId(),
        type: item.type === "file" ? "file" : "link",
        url: item.url,
        name: item.name || item.url,
      }));
      let activeApkId = data.activeApkId || "";
      if (!apks.some((item) => item.id === activeApkId)) {
        activeApkId = apks.length ? apks[apks.length - 1].id : "";
      }
      return {
        apks,
        activeApkId,
        videos: Array.isArray(data.videos) ? data.videos : [],
        nextIndex: Number.isFinite(Number(data.nextIndex)) ? Number(data.nextIndex) : 0,
        nextApkIndex: Number.isFinite(Number(data.nextApkIndex)) ? Number(data.nextApkIndex) : 0,
        schedule: data.schedule && data.schedule.url ? data.schedule : null,
      };
    } catch (e) {
      return emptyLib();
    }
  }

  function writeLib(lib) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const clean = {
      apks: lib.apks || [],
      activeApkId: lib.activeApkId || "",
      videos: lib.videos || [],
      nextIndex: lib.nextIndex || 0,
      nextApkIndex: lib.nextApkIndex || 0,
      schedule: lib.schedule || null,
    };
    fs.writeFileSync(file, JSON.stringify(clean, null, 2) + "\n");
  }

  function applyDue(lib) {
    const job = lib.schedule;
    if (!job || job.applied || !job.url || !job.at) return null;
    const when = Date.parse(job.at);
    if (!Number.isFinite(when) || when > Date.now()) return null;
    const previous = (lib.apks || []).map((item) => item.name || item.url).filter(Boolean);
    const next = {
      id: job.id || newId(),
      type: job.type === "file" ? "file" : "link",
      url: job.url,
      name: job.name || job.url,
    };
    lib.apks = [next];
    lib.activeApkId = next.id;
    lib.nextApkIndex = 0;
    job.applied = true;
    job.appliedAt = new Date().toISOString();
    job.replaced = previous;
    return { name: next.name, replaced: previous, at: job.at };
  }

  function dropPendingFile(lib) {
    const job = lib.schedule;
    if (!job || job.applied || job.type !== "file" || !job.url) return;
    const used = (lib.apks || []).some((item) => item.url === job.url);
    if (!used) removeUpload(job.url);
  }

  function activeApk(lib) {
    const apks = lib.apks || [];
    return apks.find((item) => item.id === lib.activeApkId) || apks[apks.length - 1] || null;
  }

  function present(lib) {
    return {
      apks: lib.apks || [],
      activeApkId: lib.activeApkId || "",
      apk: activeApk(lib),
      videos: lib.videos || [],
      nextIndex: lib.nextIndex || 0,
      nextApkIndex: lib.nextApkIndex || 0,
      schedule: lib.schedule || null,
    };
  }

  const history = openHistory(root);

  function logSwap(swap) {
    if (!swap) return;
    const oldNames = swap.replaced && swap.replaced.length ? swap.replaced.join(", ") : "the previous APK";
    history.add({
      kind: "apk",
      title: "Auto update applied",
      detail: oldNames + " was replaced by " + swap.name + ". The landing page now downloads the new APK.",
    });
  }

  function mutate(fn) {
    const job = queue.then(() => {
      const current = readLib();
      const first = applyDue(current);
      const result = fn(current) || { lib: current };
      const second = applyDue(result.lib);
      writeLib(result.lib);
      logSwap(first);
      if (second) logSwap(second);
      return result;
    });
    queue = job.then(
      () => {},
      () => {}
    );
    return job;
  }

  function send(res, code, body) {
    res.statusCode = code;
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(body));
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("error", reject);
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  function removeUpload(url) {
    if (!url || !String(url).startsWith("/uploads/")) return;
    fs.rmSync(path.join(uploadDir, path.basename(url)), { force: true });
  }

  function newId() {
    return crypto.randomBytes(6).toString("hex");
  }

  function downloadName(name) {
    const base = path.basename(String(name || "app.apk")).replace(/[\r\n"]/g, "").trim();
    const clean = base || "app.apk";
    return clean.toLowerCase().endsWith(".apk") ? clean : clean + ".apk";
  }

  function sendApkFile(req, res) {
    const lib = readLib();
    const id = new URL(req.url, "http://local").searchParams.get("id");
    const apk = id ? (lib.apks || []).find((item) => item.id === id) : activeApk(lib);
    if (!apk || apk.type !== "file" || !apk.url) {
      res.statusCode = 404;
      res.end("No APK uploaded");
      return;
    }
    const full = path.join(uploadDir, path.basename(apk.url));
    if (!fs.existsSync(full)) {
      res.statusCode = 404;
      res.end("APK file missing");
      return;
    }
    const name = downloadName(apk.name);
    const ascii = name.replace(/[^\x20-\x7E]/g, "_");
    res.statusCode = 200;
    res.setHeader("content-type", "application/vnd.android.package-archive");
    res.setHeader("content-disposition", 'attachment; filename="' + ascii + "\"; filename*=UTF-8''" + encodeURIComponent(name));
    res.setHeader("cache-control", "no-store");
    fs.createReadStream(full).pipe(res);
  }

  return {
    name: "library-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url || "").split("?")[0];
        if (pathOnly !== "/api/library" && pathOnly !== "/api/play" && pathOnly !== "/api/apk-next" && pathOnly !== "/api/upload" && pathOnly !== "/api/library/apk" && pathOnly !== "/api/library/videos" && pathOnly !== "/api/library/reset" && pathOnly !== "/api/apk-file" && pathOnly !== "/api/apk-schedule") {
          return next();
        }

        if (req.method === "GET" && pathOnly === "/api/apk-file") {
          sendApkFile(req, res);
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/apk-next") {
          mutate((current) => {
            const apks = current.apks || [];
            const total = apks.length;
            let start = 0;
            if (total > 1) {
              start = ((Number(current.nextApkIndex) % total) + total) % total;
              current.nextApkIndex = (start + 1) % total;
            } else {
              current.nextApkIndex = 0;
            }
            return {
              lib: current,
              extra: { start, total, apk: total ? apks[start] : null },
            };
          }).then((result) => send(res, 200, result.extra));
          return;
        }

        if (req.method === "GET" && pathOnly === "/api/library") {
          mutate((current) => ({ lib: current, extra: current })).then((result) => send(res, 200, present(result.lib)));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/play") {
          mutate((current) => {
            const total = current.videos.length;
            let start = 0;
            if (total > 1) {
              start = ((current.nextIndex % total) + total) % total;
              current.nextIndex = (start + 1) % total;
            } else {
              current.nextIndex = 0;
            }
            return {
              lib: current,
              extra: {
                start,
                total,
                url: total ? current.videos[start].url : null,
                videos: current.videos,
              },
            };
          }).then((result) => send(res, 200, result.extra));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/library/apk") {
          readJson(req)
            .then((body) => {
              const url = String(body.url || "").trim();
              if (!url) {
                send(res, 400, { error: "Paste a link first." });
                return;
              }
              return mutate((current) => {
                const item = { id: newId(), type: "link", url, name: downloadName(url) };
                current.apks = current.apks || [];
                current.apks.push(item);
                current.activeApkId = item.id;
                return { lib: current, extra: current };
              }).then((result) => {
                history.add({ kind: "apk", title: "APK link added", detail: downloadName(url) });
                send(res, 200, present(result.lib));
              });
            })
            .catch(() => send(res, 400, { error: "Invalid JSON" }));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/apk-schedule") {
          readJson(req)
            .then((body) => {
              const url = String(body.url || "").trim();
              const when = Date.parse(body.at);
              if (!url) {
                send(res, 400, { error: "Add an APK file or link first." });
                return;
              }
              if (!Number.isFinite(when)) {
                send(res, 400, { error: "Pick a date and time." });
                return;
              }
              return mutate((current) => {
                dropPendingFile(current);
                current.schedule = {
                  id: newId(),
                  type: "link",
                  url,
                  name: downloadName(body.name || url),
                  at: new Date(when).toISOString(),
                  createdAt: new Date().toISOString(),
                  applied: false,
                  replaced: [],
                };
                return { lib: current, extra: current };
              }).then((result) => {
                const job = result.lib.schedule;
                if (!job || !job.applied) {
                  history.add({
                    kind: "apk",
                    title: "Auto update scheduled",
                    detail: downloadName(body.name || url) + " will replace the current APK at " + new Date(when).toLocaleString() + ". Until then, visitors keep downloading the APKs already on the page.",
                  });
                }
                send(res, 200, present(result.lib));
              });
            })
            .catch(() => send(res, 400, { error: "Invalid JSON" }));
          return;
        }

        if (req.method === "DELETE" && pathOnly === "/api/apk-schedule") {
          mutate((current) => {
            const job = current.schedule;
            if (job && !job.applied) dropPendingFile(current);
            if (job && job.applied) return { lib: current, extra: { cleared: false, name: "" } };
            const name = job ? job.name : "";
            current.schedule = null;
            return { lib: current, extra: { cleared: !!name, name } };
          }).then((result) => {
            if (result.extra && result.extra.cleared) {
              history.add({ kind: "apk", title: "Auto update cancelled", detail: result.extra.name + " will not replace the current APK." });
            }
            send(res, 200, present(result.lib));
          });
          return;
        }

        if (req.method === "DELETE" && pathOnly === "/api/library/apk") {
          readJson(req)
            .then((body) => {
              const id = String(body.id || "");
              return mutate((current) => {
                const apks = current.apks || [];
                const found = id ? apks.find((item) => item.id === id) : apks[apks.length - 1];
                if (found && found.type === "file") removeUpload(found.url);
                current.apks = found ? apks.filter((item) => item.id !== found.id) : apks;
                if (found) history.add({ kind: "apk", title: "APK deleted", detail: found.name || found.url });
                if (!current.apks.some((item) => item.id === current.activeApkId)) {
                  current.activeApkId = current.apks.length ? current.apks[current.apks.length - 1].id : "";
                }
                return { lib: current, extra: current };
              }).then((result) => send(res, 200, present(result.lib)));
            })
            .catch(() => send(res, 400, { error: "Invalid JSON" }));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/library/videos") {
          readJson(req)
            .then((body) => {
              const url = String(body.url || "").trim();
              if (!url) {
                send(res, 400, { error: "Paste a video link first." });
                return;
              }
              return mutate((current) => {
                current.videos.push({ id: newId(), type: "link", url, name: url });
                history.add({ kind: "video", title: "Video link added", detail: url });
                return { lib: current, extra: current };
              }).then((result) => send(res, 200, present(result.lib)));
            })
            .catch(() => send(res, 400, { error: "Invalid JSON" }));
          return;
        }

        if (req.method === "DELETE" && pathOnly === "/api/library/videos") {
          readJson(req)
            .then((body) => {
              const id = String(body.id || "");
              return mutate((current) => {
                const found = current.videos.find((item) => item.id === id);
                if (found && found.type === "file") removeUpload(found.url);
                if (found) history.add({ kind: "video", title: "Video deleted", detail: found.name || found.url });
                current.videos = current.videos.filter((item) => item.id !== id);
                if (current.nextIndex >= current.videos.length) current.nextIndex = 0;
                return { lib: current, extra: current };
              }).then((result) => send(res, 200, present(result.lib)));
            })
            .catch(() => send(res, 400, { error: "Invalid JSON" }));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/library/reset") {
          mutate((current) => {
            (current.apks || []).forEach((item) => {
              if (item.type === "file") removeUpload(item.url);
            });
            current.videos.forEach((item) => {
              if (item.type === "file") removeUpload(item.url);
            });
            if (current.schedule && !current.schedule.applied) dropPendingFile(current);
            history.add({ kind: "reset", title: "Library reset", detail: "APKs, videos, and any waiting auto update were cleared." });
            return { lib: emptyLib(), extra: emptyLib() };
          }).then((result) => send(res, 200, present(result.lib)));
          return;
        }

        if (req.method === "POST" && pathOnly === "/api/upload") {
          const query = new URL(req.url, "http://local").searchParams;
          const kind = query.get("kind");
          const scheduleAt = Date.parse(query.get("at") || "");
          if (kind !== "apk" && kind !== "video" && kind !== "schedule") {
            send(res, 400, { error: "Upload kind must be apk, video, or schedule." });
            return;
          }
          if (kind === "schedule" && !Number.isFinite(scheduleAt)) {
            send(res, 400, { error: "Pick a date and time for the auto update." });
            return;
          }
          let savedName = "";
          let original = "";
          let limited = false;
          let failed = "";
          let writeDone = Promise.resolve();
          const bb = Busboy({
            headers: req.headers,
            limits: { files: 1, fileSize: MAX_BYTES },
          });
          bb.on("file", (_name, stream, info) => {
            original = info.filename || "upload";
            const ext = path.extname(original).toLowerCase();
            const allow = kind === "video" ? VIDEO_EXT : APK_EXT;
            if (!allow.has(ext)) {
              failed = kind === "video" ? "Upload an mp4, webm, ogg, or mov file." : "Upload an .apk file.";
              stream.resume();
              return;
            }
            fs.mkdirSync(uploadDir, { recursive: true });
            savedName = Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ext;
            const dest = path.join(uploadDir, savedName);
            const out = fs.createWriteStream(dest);
            writeDone = new Promise((resolve) => {
              out.on("finish", resolve);
              out.on("error", resolve);
            });
            stream.pipe(out);
            stream.on("limit", () => {
              limited = true;
              stream.unpipe(out);
              out.destroy();
              fs.rmSync(dest, { force: true });
            });
          });
          bb.on("error", () => send(res, 400, { error: "Upload failed." }));
          bb.on("close", () => {
            writeDone.then(() => {
              if (limited) {
                send(res, 413, { error: "File is larger than 200 MB." });
                return;
              }
              if (failed || !savedName) {
                send(res, 400, { error: failed || "Choose a file first." });
                return;
              }
              const url = "/uploads/" + savedName;
              mutate((current) => {
                if (kind === "apk") {
                  const item = { id: newId(), type: "file", url, name: downloadName(original) };
                  current.apks = current.apks || [];
                  current.apks.push(item);
                  current.activeApkId = item.id;
                  history.add({ kind: "apk", title: "APK uploaded", detail: item.name });
                } else if (kind === "schedule") {
                  dropPendingFile(current);
                  current.schedule = {
                    id: newId(),
                    type: "file",
                    url,
                    name: downloadName(original),
                    at: new Date(scheduleAt).toISOString(),
                    createdAt: new Date().toISOString(),
                    applied: false,
                    replaced: [],
                  };
                } else {
                  current.videos.push({ id: newId(), type: "file", url, name: original });
                  history.add({ kind: "video", title: "Video uploaded", detail: original });
                }
                return { lib: current, extra: current };
              }).then((result) => {
                const job = result.lib.schedule;
                if (kind === "schedule" && (!job || !job.applied)) {
                  history.add({
                    kind: "apk",
                    title: "Auto update scheduled",
                    detail: downloadName(original) + " will replace the current APK at " + new Date(scheduleAt).toLocaleString() + ". Until then, visitors keep downloading the APKs already on the page.",
                  });
                }
                send(res, 200, present(result.lib));
              });
            });
          });
          req.pipe(bb);
          return;
        }

        send(res, 405, { error: "Method not allowed" });
      });
      const timer = setInterval(() => {
        mutate((current) => ({ lib: current, extra: current })).catch(() => {});
      }, 15000);
      if (timer.unref) timer.unref();
    },
  };
}
