"use client";

import { useState } from "react";
import { ClipboardList, Check } from "lucide-react";
import PixelButton from "../../ui/PixelButton";
import HeroBackground from "./HeroBackground";
import bdZoneLogo from "../../../assets/Logo/bd-zone-two.png";

const SERVER_IP = "play.bdzonemc.com";

export default function Hero() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(SERVER_IP);
      } else {
        // Fallback for older mobile browsers / non-HTTPS contexts
        const textArea = document.createElement("textarea");
        textArea.value = SERVER_IP;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <section className="relative flex  flex-col items-center overflow-hidden text-center">
      <HeroBackground />

      {/* Dawn mark — plain opacity diye, background-er upore transparent hoye boshe */}
      <div className="relative z-90  flex items-center justify-center mt-20 sm:mt-20 md:mt-20 lg:mt-20 ">
        <img
          src={bdZoneLogo}
          alt="Dawn"
          className="relative  w-auto opacity-100 mix-blend-overlay h-30 xs:h-20 sm:h-40 md:h-50 lg:h-60"
        />
      </div>

      {/* Content — ekhon fully centered, logo r nichey */}
      <div className="relative z-100 mx-auto  w-full max-w-200 lg:mt-15 md:mt-15 sm:mt-15 mt-15 xs:mt-15">
        <h1 className="gradient-text  leading-tight pointer-events-none xs:text-[30px] md:text-[36px] text-[20px] sm:text-[36px] px-2">
          Welcome to <span className="gold-gradient-text">BDZONE</span>
        </h1>
        <p className="text-(--color-text) lg:text-[15px] md:text-[15px] sm:text-[15px] text-[13px] pt-4 leading-relaxed sm:pt-6 sm:px-6 px-4">
          Experience a unique world where nature meets adventure. Join our
          community, build your legacy, and let your creativity bloom.
        </p>

        <div className="mx-auto mt-6 flex w-full max-w-90 items-center justify-center gap-1 sm:mt-8 px-14 lg:px-0 md:px-0">
          <PixelButton
            tone="primary"
            size="lg"
            className="px-2! py-5! w-full! min-w-0 sm:px-6! sm:py-8!"
            textClassName="gold-gradient-text text-[clamp(9px,3.4vw,14px)]! tracking-[0.04em] sm:tracking-[0.08em]"
            onClick={handleCopy}
            type="button"
            aria-label="Copy server address"
          >
            {copied ? "Copied!" : SERVER_IP}
          </PixelButton>
          <PixelButton
            tone="primary"
            icon={copied ? Check : ClipboardList}
            size="lg"
            className="px-4! py-5! gap-0! shrink-0 sm:px-6! sm:py-8!"
            onClick={handleCopy}
            type="button"
            aria-label="Copy server address"
            iconSize="18"
          ></PixelButton>
        </div>
      </div>
    </section>
  );
}
