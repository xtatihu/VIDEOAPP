"use client";

import { useState } from "react";
import {
  Calendar,
  Check,
  Download,
  FileDown,
  ImageIcon,
  Languages,
  Lock,
  Menu,
  ShieldCheck,
  Smartphone,
  WifiOff,
  X,
} from "lucide-react";
import {
  changelog,
  faqs,
  features,
  marquee,
  permissions,
  release,
  steps,
} from "@/lib/content";
import type { ReleaseFileInfo } from "@/lib/release-file";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mark } from "@/components/site/mark";
import {
  LockScreen,
  MoodScreen,
  PhoneFrame,
  TodayScreen,
} from "@/components/site/phone-mock";
import { DownloadDialog } from "@/components/site/download-dialog";

const featureIcons = {
  lock: Lock,
  "wifi-off": WifiOff,
  calendar: Calendar,
  image: ImageIcon,
  file: FileDown,
  languages: Languages,
} as const;

const nav = [
  { href: "#features", label: "ख़ास बातें" },
  { href: "#screens", label: "अंदर से" },
  { href: "#install", label: "इंस्टॉल" },
  { href: "#faq", label: "सवाल" },
];

export function Landing({ file }: { file: ReleaseFileInfo }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  return (
    <div className="relative pb-28 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#100e0c]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <Mark />
            <span className="font-display text-2xl leading-none text-[#f6efe4]">
              {release.appNameDeva}
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-[#cbbba8] md:flex">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-[#f6efe4]">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="hidden h-10 rounded-full bg-[#e7b15a] px-4 text-[#1a1208] hover:bg-[#f0c57a] md:inline-flex"
              onClick={() => setOpen(true)}
            >
              <Download />
              APK डाउनलोड
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-white/15 bg-transparent text-[#f6efe4] hover:bg-white/5 md:hidden"
              aria-label={menu ? "मेनू बंद करो" : "मेनू खोलो"}
              onClick={() => setMenu((value) => !value)}
            >
              {menu ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {menu ? (
          <div className="border-t border-white/10 px-4 py-3 md:hidden">
            <div className="flex flex-col">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="py-2.5 text-[#f6efe4]"
                  onClick={() => setMenu(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div>
            <Badge
              variant="outline"
              className="h-7 border-[#e7b15a]/40 bg-[#e7b15a]/10 px-3 text-[12px] text-[#f0d7a4]"
            >
              डायरेक्ट APK · बीटा {release.version}
            </Badge>
            <h1 className="font-display mt-5 text-[2.7rem] leading-[1.05] text-balance text-[#f6efe4] sm:text-6xl lg:text-[4.6rem]">
              नूर का APK,
              <span className="mt-1 block text-[#e7b15a]">
                सीधे आपके फ़ोन पर।
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#cbbba8]">
              नूर एक निजी जर्नल है। न अकाउंट, न विज्ञापन, न क्लाउड। APK लो और
              आज की एंट्री यहीं से शुरू करो।
            </p>
            <p className="mt-3 text-xs tracking-[0.22em] text-[#a89886] uppercase">
              Private journal · Offline · Hindi + English
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="h-12 rounded-full bg-[#e7b15a] px-6 text-base text-[#1a1208] shadow-[0_12px_40px_-16px_rgba(231,177,90,0.95)] hover:bg-[#f0c57a]"
                onClick={() => setOpen(true)}
              >
                <Download />
                APK डाउनलोड करो
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-full border-white/15 bg-transparent px-6 text-base text-[#f6efe4] hover:bg-white/5"
                render={<a href="#install" />}
              >
                इंस्टॉल के स्टेप
              </Button>
            </div>
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-4">
              {[
                ["फ़ाइल", file.ok ? "सैंपल पैकेज" : "मिसिंग"],
                ["वर्जन", release.version],
                ["चाहिए", release.android],
                ["बिल्ड", release.arch],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#16130f] px-4 py-3">
                  <dt className="text-[11px] tracking-wide text-[#a89886]">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm text-[#f6efe4]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="absolute top-6 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#f3d7a1,#e7b15a_42%,#8a4b28_68%,transparent_72%)] opacity-90" />
            <p className="pointer-events-none absolute -top-6 right-0 font-display text-[7rem] leading-none text-white/[0.06] select-none">
              {release.version}
            </p>
            <PhoneFrame className="lg:-rotate-6">
              <TodayScreen />
            </PhoneFrame>
          </div>
        </section>

        <div className="mt-6 overflow-hidden border-y border-white/10 py-3">
          <div className="marquee-track flex w-max gap-8">
            {[...marquee, ...marquee].map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="flex items-center gap-8 text-sm tracking-wide text-[#cbbba8]"
              >
                {item}
                <span className="size-1.5 rounded-full bg-[#e7b15a]" />
              </span>
            ))}
          </div>
        </div>

        <section id="features" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.22em] text-[#e7b15a] uppercase">
              ख़ास बातें
            </p>
            <h2 className="font-display mt-3 text-4xl text-[#f6efe4] sm:text-5xl">
              जो वादा है, वही ऐप में है।
            </h2>
            <p className="mt-4 text-lg text-[#cbbba8]">
              छह चीज़ें। जानबूझकर कम, ताकि जर्नल जर्नल रहे — और एक और डैशबोर्ड न बन जाए।
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = featureIcons[feature.icon];
              return (
                <Card
                  key={feature.title}
                  className="bg-[#1a1612] ring-white/10 transition-colors hover:bg-[#221c17]"
                >
                  <CardHeader>
                    <div className="mb-2 grid size-11 place-items-center rounded-2xl bg-[#e7b15a]/15 text-[#e7b15a]">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="font-display text-2xl font-normal text-[#f6efe4]">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-[15px] leading-relaxed text-[#cbbba8]">
                      {feature.body}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        <section id="screens" className="scroll-mt-24 border-y border-white/10 bg-black/20 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs tracking-[0.22em] text-[#e7b15a] uppercase">
                अंदर से
              </p>
              <h2 className="font-display mt-3 text-4xl text-[#f6efe4] sm:text-5xl">
                तीन स्क्रीन। बाकी चुप।
              </h2>
            </div>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {[
                {
                  title: "आज",
                  copy: "एक प्रॉम्प्ट, एक एंट्री, मूड का रंग।",
                  screen: <TodayScreen />,
                },
                {
                  title: "मूड",
                  copy: "महीना रंगों में। शब्द बाद में पढ़ना।",
                  screen: <MoodScreen />,
                },
                {
                  title: "ताला",
                  copy: "खोलने से पहले पिन। हमेशा।",
                  screen: <LockScreen />,
                },
              ].map((item) => (
                <figure key={item.title} className="text-center">
                  <PhoneFrame>{item.screen}</PhoneFrame>
                  <figcaption className="mt-5">
                    <p className="font-display text-3xl text-[#f6efe4]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-[#cbbba8]">{item.copy}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="install" className="scroll-mt-24 mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs tracking-[0.22em] text-[#e7b15a] uppercase">
              इंस्टॉल
            </p>
            <h2 className="font-display mt-3 text-4xl text-[#f6efe4] sm:text-5xl">
              चार स्टेप। फ़ोन तैयार।
            </h2>
            <ol className="mt-8">
              {steps.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[auto_1fr] gap-4">
                  <div className="flex flex-col items-center">
                    <span className="grid size-10 place-items-center rounded-full bg-[#e7b15a] text-sm font-semibold text-[#1a1208]">
                      {index + 1}
                    </span>
                    {index < steps.length - 1 ? (
                      <span className="my-1 w-px flex-1 bg-white/15" />
                    ) : null}
                  </div>
                  <div className={index < steps.length - 1 ? "pb-8" : ""}>
                    <h3 className="text-lg text-[#f6efe4]">{step.title}</h3>
                    <p className="mt-1 leading-relaxed text-[#cbbba8]">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-4">
            <Card className="bg-[#1a1612] ring-white/10">
              <CardHeader>
                <div className="mb-2 flex items-center gap-2 text-[#e7b15a]">
                  <ShieldCheck className="size-5" />
                  <span className="text-xs tracking-[0.18em] uppercase">
                    अनुमतियाँ
                  </span>
                </div>
                <CardTitle className="font-display text-3xl font-normal text-[#f6efe4]">
                  जो नहीं माँगता, वो ज़्यादा ज़रूरी है।
                </CardTitle>
                <ul className="mt-2 space-y-3">
                  {permissions.map((item) => (
                    <li key={item.name} className="flex items-start gap-3">
                      <span
                        className={
                          item.allowed
                            ? "mt-0.5 grid size-5 place-items-center rounded-full bg-[#e7b15a]/20 text-[#e7b15a]"
                            : "mt-0.5 grid size-5 place-items-center rounded-full bg-white/5 text-[#a89886]"
                        }
                      >
                        {item.allowed ? (
                          <Check className="size-3" />
                        ) : (
                          <X className="size-3" />
                        )}
                      </span>
                      <span>
                        <span className="block text-[#f6efe4]">{item.name}</span>
                        <span className="text-sm text-[#a89886]">{item.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardHeader>
            </Card>

            <Card className="bg-[#1a1612] ring-white/10">
              <CardHeader>
                <CardTitle className="font-display text-2xl font-normal text-[#f6efe4]">
                  इस वर्जन में
                </CardTitle>
                <ul className="mt-2 space-y-2 text-sm">
                  {changelog.map((item) => (
                    <li key={item.version} className="flex gap-3 text-[#cbbba8]">
                      <span className="font-mono text-[#e7b15a]">{item.version}</span>
                      <span>{item.note}</span>
                    </li>
                  ))}
                </ul>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 border-t border-white/10">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs tracking-[0.22em] text-[#e7b15a] uppercase">
                सवाल
              </p>
              <h2 className="font-display mt-3 text-4xl text-[#f6efe4] sm:text-5xl">
                डाउनलोड से पहले।
              </h2>
              <p className="mt-4 text-[#cbbba8]">
                हैश मिलाओ, अनुमति समझो, फिर बटन दबाओ।
              </p>
            </div>
            <Accordion className="border-t border-white/10">
              {faqs.map((item) => (
                <AccordionItem
                  key={item.q}
                  value={item.q}
                  className="border-white/10"
                >
                  <AccordionTrigger className="py-4 text-base text-[#f6efe4] hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[15px] leading-relaxed text-[#cbbba8]">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_#f0d7a4,_#e7b15a_28%,#8a4b28_70%,#1a1208)] px-6 py-10 sm:px-10 md:flex-row md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[#1a1208]/80">
                <Smartphone className="size-4" />
                <span className="text-xs tracking-[0.18em] uppercase">
                  सैंपल पैकेज · {release.android}
                </span>
              </div>
              <h2 className="font-display text-4xl text-[#1a1208] sm:text-5xl">
                लिखना शुरू करने में एक मिनट।
              </h2>
            </div>
            <Button
              type="button"
              className="h-12 rounded-full bg-[#1a1208] px-6 text-base text-[#f6efe4] hover:bg-black"
              onClick={() => setOpen(true)}
            >
              <Download />
              APK डाउनलोड करो
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[#a89886] sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Mark className="size-7" />
            <span>
              {release.appNameDeva} बीटा {release.version}
            </span>
          </div>
          <p className="max-w-xl leading-relaxed">
            होस्ट की गई फ़ाइल एक सैंपल पैकेज है, ताकि यह पेज पूरा लगे। अपना
            साइन किया APK <span className="text-[#f6efe4]">public/downloads</span>{" "}
            में रखो — साइज़ और SHA-256 अपने आप इसी पेज पर आ जाएँगे।
          </p>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#16130f]/92 p-3 backdrop-blur-md md:hidden">
        <Button
          type="button"
          className="h-12 w-full rounded-full bg-[#e7b15a] text-base text-[#1a1208] hover:bg-[#f0c57a]"
          onClick={() => setOpen(true)}
        >
          <Download />
          APK डाउनलोड करो
        </Button>
      </div>

      <DownloadDialog open={open} onOpenChange={setOpen} file={file} />
    </div>
  );
}
