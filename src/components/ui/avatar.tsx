type AvatarSize = 22 | 30 | 34 | 44;

const sizeClasses: Record<AvatarSize, string> = {
  22: "h-[22px] w-[22px] text-[9px]",
  30: "h-[30px] w-[30px] text-[11px]",
  34: "h-[34px] w-[34px] text-[12px]",
  44: "h-[44px] w-[44px] text-[15px]",
};

type AvatarProps = {
  name: string;
  size?: AvatarSize;
  gold?: boolean;
  className?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ name, size = 34, gold = false, className = "" }: AvatarProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none ${sizeClasses[size]} ${
        gold
          ? "bg-[#b68d3d] text-white"
          : "bg-[#e4e8eb] text-[#3a4a55]"
      } ${className}`}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
