"use client";

import { useState } from "react";
import { Check, Copy, Download, ShieldAlert } from "lucide-react";
import { release } from "@/lib/content";
import type { ReleaseFileInfo } from "@/lib/release-file";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export function DownloadDialog({
  open,
  onOpenChange,
  file,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: ReleaseFileInfo;
}) {
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);

  async function copyHash() {
    if (!file.sha256) return;
    try {
      await navigator.clipboard.writeText(file.sha256);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function startDownload() {
    const link = document.createElement("a");
    link.href = release.path;
    link.download = release.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStarted(true);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setStarted(false);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden bg-[#221c17] p-0 text-[#f6efe4] ring-[#e7b15a]/20 sm:max-w-md">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(231,177,90,0.22),_transparent_60%)] px-5 pt-5 pb-4">
          <DialogHeader>
            <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-[#e7b15a] text-[#1a1208]">
              <Download className="size-5" />
            </div>
            <DialogTitle className="font-display text-3xl font-normal text-[#f6efe4]">
              {release.appNameDeva} {release.version}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-[#cbbba8]">
              {release.filename}
            </DialogDescription>
          </DialogHeader>
          <Badge className="mt-3 bg-[#e7b15a]/15 text-[#f0d7a4] ring-1 ring-[#e7b15a]/30">
            सैंपल बिल्ड
          </Badge>
        </div>

        <div className="space-y-4 px-5 py-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["साइज़", file.sizeLabel],
              ["एंड्रॉइड", release.android],
              ["आर्किटेक्चर", release.arch],
              ["अपडेट", release.updated],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-black/25 px-3 py-2.5">
                <dt className="text-[11px] tracking-wide text-[#a89886]">
                  {label}
                </dt>
                <dd className="mt-0.5 text-[#f6efe4]">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-xl bg-black/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] tracking-wide text-[#a89886]">SHA-256</p>
              <Button
                type="button"
                variant="ghost"
                className="h-7 px-2 text-[#e7b15a] hover:bg-white/5 hover:text-[#f0d7a4]"
                onClick={copyHash}
                disabled={!file.ok}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "कॉपी हो गया" : "कॉपी"}
              </Button>
            </div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed break-all text-[#f6efe4]">
              {file.ok ? file.sha256 : "फ़ाइल नहीं मिली"}
            </p>
          </div>

          <div className="flex gap-2 rounded-xl bg-[#3a2a18] px-3 py-3 text-[13px] leading-relaxed text-[#f0d7a4]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              यह सैंपल पैकेज है, इंस्टॉल होने वाला ऐप नहीं। बटन आज़माने के लिए
              है। असली APK README में लिखे रास्ते पर रखो।
            </p>
          </div>

          {started ? (
            <div className="rounded-xl bg-[#1d3328] px-3 py-3 text-sm text-[#d7f0e2]">
              डाउनलोड शुरू हो गया। फ़ाइल नोटिफ़िकेशन या डाउनलोड फ़ोल्डर में
              दिखेगी।
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 p-4">
          <Button
            type="button"
            className="h-12 w-full rounded-full bg-[#e7b15a] text-base text-[#1a1208] hover:bg-[#f0c57a]"
            onClick={startDownload}
            disabled={!file.ok}
          >
            <Download />
            {started ? "दोबारा डाउनलोड करो" : "डाउनलोड शुरू करो"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
