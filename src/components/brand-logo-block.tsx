"use client";

import Image from "next/image";
import { DIRECTION_ALG_LOGO_URL } from "@/lib/brand-assets";

export { DIRECTION_ALG_LOGO_URL };

type BrandLogoBlockProps = {
  variant?: "sidebar" | "drawer" | "compact";
};

export function BrandLogoBlock({ variant = "sidebar" }: BrandLogoBlockProps) {
  if (variant === "compact") {
    return (
      <div className="relative h-9 w-[132px] shrink-0 sm:h-10 sm:w-[148px]">
        <Image
          src={DIRECTION_ALG_LOGO_URL}
          alt="Direction l'Algerie"
          fill
          className="object-contain object-left"
          sizes="148px"
          priority
        />
      </div>
    );
  }

  const logoBox =
    variant === "drawer"
      ? "relative h-12 w-44 sm:h-14 sm:w-52"
      : "relative h-14 w-48 sm:h-16 sm:w-56";

  return (
    <div className="border-b border-white/10 bg-gradient-to-b from-[#0f1c24] to-[#182b35]">
      <div
        className={
          variant === "drawer"
            ? "flex flex-col items-center gap-2 px-4 py-4 text-center"
            : "flex flex-col items-center gap-3 px-4 py-6 text-center lg:px-5 lg:py-7"
        }
      >
        <div className={logoBox}>
          <Image
            src={DIRECTION_ALG_LOGO_URL}
            alt="Direction l'Algerie"
            fill
            className="object-contain object-center"
            sizes="(max-width: 1024px) 220px, 260px"
            priority
          />
        </div>
        <p className="max-w-[18rem] text-[10px] font-semibold uppercase tracking-[0.26em] text-white/72">
          Travel Lead Desk
        </p>
        {variant === "sidebar" ? (
          <p className="max-w-[16rem] text-xs leading-relaxed text-white/78">
            Espace interne pour orchestrer les demandes de voyage sur mesure.
          </p>
        ) : null}
      </div>
    </div>
  );
}
