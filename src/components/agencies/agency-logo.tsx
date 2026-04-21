import { deriveInitials } from "@/lib/agencies/logo-upload";

const SIZE_MAP = {
  32: { px: 32, text: "text-[11px]" },
  40: { px: 40, text: "text-[13px]" },
  48: { px: 48, text: "text-[15px]" },
  64: { px: 64, text: "text-[20px]" },
} as const;

type AgencyLogoSize = keyof typeof SIZE_MAP;

interface AgencyLogoProps {
  name: string;
  logoUrl: string | null;
  size?: AgencyLogoSize;
  className?: string;
}

export function AgencyLogo({ name, logoUrl, size = 48, className = "" }: AgencyLogoProps) {
  const { px, text } = SIZE_MAP[size];
  const initials = deriveInitials(name);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        width={px}
        height={px}
        className={`rounded-[6px] object-cover ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-[6px] bg-[var(--steel)] font-semibold text-[var(--steel-ink)] ${text} ${className}`}
      style={{ width: px, height: px }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
