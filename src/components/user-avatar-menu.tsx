"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { User, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

type UserAvatarMenuProps = {
  userName: string;
  avatarUrl: string | null;
};

type DropdownPos = { top: number; left: number };

export function UserAvatarMenu({ userName, avatarUrl }: UserAvatarMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    // Position dropdown below-right of button; if too close to bottom, open upward
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = 120; // approx height
    const top = spaceBelow > dropH ? rect.bottom + 6 : rect.top - dropH - 6;
    const left = Math.min(rect.left, window.innerWidth - 200);
    setPos({ top, left });
    setOpen(true);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const dropdown = open && pos ? createPortal(
    <div
      ref={dropRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
      className="w-48 rounded-lg border border-[#e4e8eb] bg-white py-1 shadow-lg"
    >
      <div className="border-b border-[#f0f2f4] px-3 py-2">
        <p className="truncate text-[12px] font-semibold text-[#0e1a21]">{userName}</p>
      </div>

      <Link
        href="/profile"
        onClick={() => setOpen(false)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-[#3a4a55] hover:bg-[#f6f7f8]"
      >
        <User className="size-3.5 shrink-0 text-[#6b7a85]" aria-hidden />
        Mon profil
      </Link>

      <div className="my-1 border-t border-[#f0f2f4]" />

      <button
        type="button"
        onClick={handleSignOut}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-[#c1411f] hover:bg-[#fceee9]"
      >
        <LogOut className="size-3.5 shrink-0" aria-hidden />
        Se déconnecter
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        className="flex cursor-pointer items-center rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15323f]/40"
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

      {dropdown}
    </>
  );
}
