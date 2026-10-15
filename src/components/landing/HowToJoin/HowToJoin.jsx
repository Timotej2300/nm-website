import { useState } from "react";
import { Copy, Check } from "lucide-react";
import PixelBox from "../../ui/PixelBox";
import PixelButton from "../../ui/PixelButton";

const STEPS = [
  {
    number: 1,
    title: "Copy Server IP",
    description: "Click the button below to copy our server address",
  },
  {
    number: 2,
    title: "Launch Minecraft",
    description: "Open your Minecraft Java or Bedrock Edition",
  },
  {
    number: 3,
    title: "Add Server",
    description: "Go to Multiplayer → Add Server → Paste the IP",
  },
  {
    number: 4,
    title: "Join & Play!",
    description: "Connect and start your adventure with us",
  },
];

const EDITIONS = [
  {
    key: "java",
    title: "Java Edition",
    subtitle: "For PC Minecraft",
    address: "play.bdzonemc.com",
    tone: "primary",
    recommended: true,
    textCol: "gold-gradient-text",
  },
  {
    key: "bedrock",
    title: "Bedrock Edition",
    subtitle: "For Mobile, Console & Windows 10",
    address: "pe.bdzonemc.com",
    tone: "success",
    recommended: false,
    textCol: "green-gradient-text",
  },
];

function CopyField({ address, tone, textCol }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — fail silently
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md bg-black/40 px-4 py-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]">
      <div className="flex-1">
        <p className="text-[9.5px] tracking-[0.14em] text-(--color-text-muted)">
          SERVER ADDRESS
        </p>
        <span className={`${textCol} text-[13px] `}>
          {address}
        </span>
      </div>
      <PixelButton
        tone={tone}
        filled
        size="sm"
        className="px-2! py-4! gap-0! "
        onClick={handleCopy}
        icon={copied ? Check : Copy}
        iconSize={16}
      />
    </div>
  );
}

export default function HowToJoin() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-25 sm:px-6">


        <h2 className="title gold-gradient-text">How to Join</h2>
        <p className="p">Connect to our server in just a few simple steps</p>


      <div className="relative mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ number, title, description }) => {
          const isLast = number === STEPS.length;
          return (
            <PixelBox
              key={number}
              tone="primary"
              filled={isLast}
              className={`pixel-notch ${isLast ? "step-pulse" : ""}`}
              contentClassName="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`hex-badge flex h-11 w-11 shrink-0 items-center justify-center text-[16px] font-extrabold ${
                    isLast
                      ? "bg-(--color-primary) text-white"
                      : "bg-(--color-primary)/15 text-(--color-primary)"
                  }`}
                >
                  {number}
                </span>
                <span className="text-[9.5px] tracking-[0.18em] text-(--color-text-muted)">
                  STEP {number}
                </span>
              </div>

              <h3 className="text-[13px] text-(--color-text)">{title}</h3>
              <p className="text-[11.5px] leading-relaxed text-(--color-text-muted)">
                {description}
              </p>

              {/* {!isLast && (
                <span className="pointer-events-none absolute top-[26px] left-full hidden h-[2px] w-6 bg-[repeating-linear-gradient(90deg,var(--color-primary)_0_6px,transparent_6px_12px)] sm:block" />
              )} */}
            </PixelBox>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {EDITIONS.map(({ key, title, subtitle, address, textCol, tone, recommended }) => (
          <PixelBox
            key={key}
            tone={tone}
            className="pixel-notch overflow-hidden transition-transform hover:-translate-y-1"
            contentClassName="flex flex-col gap-4"
          >
            {recommended && (
              <span className="absolute -right-9 top-4 w-32 rotate-45 bg-(--color-primary) py-1 text-center text-[9.5px] font-bold tracking-[0.1em] text-white shadow-md">
                RECOMMENDED
              </span>
            )}

            <div>
              <h3 className={`${textCol} text-[15px] font-semibold`}>{title}</h3>
              <p className="text-[11.5px] text-(--color-text-muted)">{subtitle}</p>
            </div>

            <CopyField address={address} tone={tone} textCol={textCol} />
          </PixelBox>
        ))}
      </div>
    </section>
  );
}