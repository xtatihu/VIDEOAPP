import { cn } from "cn";

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-medium tracking-wide text-[#f6efe4]/80">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span className="flex gap-0.5">
          <i className="h-1.5 w-0.5 rounded-full bg-current" />
          <i className="h-2 w-0.5 rounded-full bg-current" />
          <i className="h-2.5 w-0.5 rounded-full bg-current" />
        </span>
        <span className="ml-1 h-2 w-4 rounded-[2px] border border-current">
          <span className="block h-full w-2/3 bg-current" />
        </span>
      </span>
    </div>
  );
}

export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-[250px] sm:w-[270px]", className)}>
      <div className="rounded-[2.5rem] bg-gradient-to-b from-white/50 via-white/10 to-white/5 p-px shadow-[0_30px_80px_-28px_rgba(0,0,0,0.85)]">
        <div className="relative rounded-[2.45rem] bg-[#090807] p-[9px]">
          <div className="absolute top-[14px] left-1/2 z-20 h-[18px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
          <div className="relative overflow-hidden rounded-[2rem] bg-[#1a1410]">
            <div className="phone-shine pointer-events-none absolute inset-0 z-10" />
            {children}
            <div className="flex justify-center pb-2">
              <span className="h-1 w-24 rounded-full bg-white/25" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TodayScreen() {
  return (
    <div className="flex h-[500px] flex-col sm:h-[530px]">
      <StatusBar />
      <div className="px-5 pt-6">
        <p className="text-[11px] tracking-[0.18em] text-[#e7b15a]">30 सितंबर</p>
        <h3 className="font-display mt-1 text-[2rem] leading-none text-[#f6efe4]">
          नमस्ते
        </h3>
        <p className="mt-2 text-[13px] leading-snug text-[#cbbba8]">
          आज एक लाइन काफ़ी है।
        </p>
      </div>
      <div className="mx-4 mt-5 rounded-2xl bg-[#2a2118] p-4 ring-1 ring-white/10">
        <p className="text-[13px] leading-relaxed text-[#f6efe4]">
          सुबह की चाय ठंडी हो गई, और मैंने पहली बार चुप रहना चुना।
        </p>
        <div className="mt-4 flex gap-1.5">
          {["#6e3b34", "#c47a45", "#e7b15a", "#8d9a78", "#d7c4a8"].map(
            (color, index) => (
              <span
                key={color}
                className="size-3.5 rounded-full"
                style={{
                  background: color,
                  outline: index === 2 ? "2px solid #f6efe4" : undefined,
                  outlineOffset: 2,
                }}
              />
            ),
          )}
        </div>
      </div>
      <div className="mt-4 space-y-2 px-4">
        {[
          ["कल", "बाज़ार में इत्र की दुकान बंद थी।"],
          ["परसों", "बारिश में छत टपक रही थी।"],
        ].map(([day, line]) => (
          <div
            key={day}
            className="rounded-xl bg-black/20 px-3 py-2.5 ring-1 ring-white/5"
          >
            <p className="text-[10px] tracking-wide text-[#e7b15a]">{day}</p>
            <p className="text-[12px] text-[#e7dccb]">{line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MoodScreen() {
  const shades = [
    "#6e3b34",
    "#e7b15a",
    "#8d9a78",
    "#c47a45",
    "#3a322c",
    "#e7b15a",
    "#d7c4a8",
    "#6e3b34",
    "#8d9a78",
    "#e7b15a",
  ];
  return (
    <div className="flex h-[500px] flex-col sm:h-[530px]">
      <StatusBar />
      <div className="px-5 pt-6">
        <p className="text-[11px] tracking-[0.18em] text-[#e7b15a]">सितंबर</p>
        <h3 className="font-display mt-1 text-[2rem] leading-none text-[#f6efe4]">
          मूड
        </h3>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2 px-4">
        {Array.from({ length: 30 }, (_, index) => (
          <span
            key={index}
            className="aspect-square rounded-full"
            style={{ background: shades[index % shades.length] }}
          />
        ))}
      </div>
      <div className="mx-4 mt-6 rounded-2xl bg-[#2a2118] p-4">
        <p className="text-[12px] text-[#cbbba8]">इस हफ़्ते ज़्यादातर</p>
        <p className="font-display mt-1 text-2xl text-[#f6efe4]">गर्म, शांत</p>
      </div>
    </div>
  );
}

export function LockScreen() {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", ""];
  return (
    <div className="flex h-[500px] flex-col sm:h-[530px]">
      <StatusBar />
      <div className="px-5 pt-8 text-center">
        <p className="font-display text-3xl text-[#f6efe4]">नूर</p>
        <p className="mt-2 text-[13px] text-[#cbbba8]">पिन डालो</p>
        <div className="mt-4 flex justify-center gap-2.5">
          {[0, 1, 2, 3].map((dot) => (
            <span
              key={dot}
              className={
                dot < 2
                  ? "size-2.5 rounded-full bg-[#e7b15a]"
                  : "size-2.5 rounded-full bg-white/20"
              }
            />
          ))}
        </div>
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2.5 px-8 pb-4">
        {keys.map((key, index) => (
          <span
            key={`${key}-${index}`}
            className={
              key
                ? "grid h-12 place-items-center rounded-full bg-white/[0.08] text-lg text-[#f6efe4] ring-1 ring-white/10"
                : "h-12"
            }
          >
            {key}
          </span>
        ))}
      </div>
    </div>
  );
}
