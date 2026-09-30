import type { Metadata, Viewport } from "next";
import { Geist_Mono, Noto_Sans_Devanagari, Tiro_Devanagari_Hindi } from "next/font/google";
import "./globals.css";

const display = Tiro_Devanagari_Hindi({
  weight: "400",
  subsets: ["devanagari", "latin"],
  variable: "--font-display-family",
  display: "swap",
});

const body = Noto_Sans_Devanagari({
  weight: ["400", "500", "600", "700"],
  subsets: ["devanagari", "latin"],
  variable: "--font-body-family",
  display: "swap",
});

const mono = Geist_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: "नूर — APK डाउनलोड",
  description:
    "नूर, एक निजी एंड्रॉइड जर्नल। डायरेक्ट APK, Android 8+, बिना अकाउंट और बिना क्लाउड।",
  applicationName: "Noor",
};

export const viewport: Viewport = {
  themeColor: "#100e0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hi"
      className={`${display.variable} ${body.variable} ${mono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-[#100e0c] text-[#f6efe4]">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[#100e0c]" />
          <div className="absolute -top-40 right-[-8%] h-[520px] w-[520px] rounded-full bg-[#e7b15a]/16 blur-[120px]" />
          <div className="absolute top-[38%] -left-24 h-[420px] w-[420px] rounded-full bg-[#6e2e2a]/30 blur-[120px]" />
          <div className="grain absolute inset-0" />
        </div>
        {children}
      </body>
    </html>
  );
}
