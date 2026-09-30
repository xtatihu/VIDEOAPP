import { createHash } from "crypto";
import { createReadStream } from "fs";
import path from "path";
import { release } from "@/lib/content";

export type ReleaseFileInfo = {
  ok: boolean;
  bytes: number;
  sha256: string;
  sizeLabel: string;
};

export function formatBytes(bytes: number) {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export async function getReleaseFile(): Promise<ReleaseFileInfo> {
  const full = path.join(process.cwd(), "public", "downloads", release.filename);

  try {
    const { bytes, sha256 } = await hashFile(full);
    return { ok: true, bytes, sha256, sizeLabel: formatBytes(bytes) };
  } catch {
    return { ok: false, bytes: 0, sha256: "", sizeLabel: "—" };
  }
}

function hashFile(filePath: string) {
  return new Promise<{ bytes: number; sha256: string }>((resolve, reject) => {
    const hash = createHash("sha256");
    let bytes = 0;
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      bytes += buffer.length;
      hash.update(buffer);
    });
    stream.on("end", () => resolve({ bytes, sha256: hash.digest("hex") }));
    stream.on("error", reject);
  });
}
