"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

type UserAvatarMenuProps = {
  userName: string;
  avatarUrl: string | null;
};

export function UserAvatarMenu({ userName, avatarUrl }: UserAvatarMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15323f]/40"
        aria-label="Menu utilisateur"
        aria-expanded={open}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={userName}
            className="size-[30px] rounded-full object-cover"
          />
        ) : (
          <Avatar name={userName} size={30} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-[#e4e8eb] bg-white py-1 shadow-lg">
          <div className="border-b border-[#f0f2f4] px-3 py-2">
            <p className="truncate text-[12px] font-semibold text-[#0e1a21]">{userName}</p>
          </div>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[#3a4a55] hover:bg-[#f6f7f8]"
          >
            <User className="size-3.5 shrink-0 text-[#6b7a85]" aria-hidden />
            Mon profil
          </Link>

          <div className="my-1 border-t border-[#f0f2f4]" />

          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[#c1411f] hover:bg-[#fceee9]"
          >
            <LogOut className="size-3.5 shrink-0" aria-hidden />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
