"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenText,
  Bot,
  ChevronDown,
  CircleHelp,
  Menu,
  RotateCcw,
  X,
} from "lucide-react";
import { useState, type PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "คุยกับน้องฟ้า", icon: Bot },
  { href: "/knowledge", label: "คลังความรู้", icon: BookOpenText },
  { href: "/gaps", label: "Knowledge Gaps", icon: CircleHelp },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState<"manager" | "member">("manager");
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState("");

  async function resetDemo() {
    if (!window.confirm("รีเซ็ต Knowledge และ Knowledge Gaps กลับเป็นข้อมูลเริ่มต้นหรือไม่?")) {
      return;
    }
    setResetting(true);
    setNotice("");
    const response = await fetch("/api/reset", { method: "POST" });
    setResetting(false);
    if (!response.ok) {
      setNotice("รีเซ็ตข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
      return;
    }
    setNotice("รีเซ็ตข้อมูล Demo แล้ว");
    router.refresh();
  }

  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Bot className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[0.95rem] font-bold leading-tight">น้องฟ้า</span>
            <span className="block text-xs text-muted-foreground">ICONIC Knowledge</span>
          </span>
        </Link>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="ปิดเมนู"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="mx-4 mb-5 flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">
        <span>Prototype</span>
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
      </div>

      <nav aria-label="เมนูหลัก" className="flex-1 space-y-1 px-3">
        {navigation
          .filter((item) => role === "manager" || item.href === "/")
          .map((item) => {
          const current = isCurrent(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                current
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-[1.125rem]" aria-hidden="true" />
              {item.label}
            </Link>
          );
          })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <label className="mb-1.5 block px-1 text-xs font-medium text-muted-foreground" htmlFor="demo-role">
          มุมมองสำหรับ Demo
        </label>
        <div className="relative">
          <select
            id="demo-role"
            className="h-11 w-full appearance-none rounded-lg border bg-background px-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={role}
            onChange={(event) => {
              const nextRole = event.target.value as "manager" | "member";
              setRole(nextRole);
              setNotice(
                nextRole === "member"
                  ? "Team Member เห็นเฉพาะหน้าถามตอบ"
                  : "เปิดเครื่องมือจัดการ Knowledge แล้ว",
              );
              if (nextRole === "member" && pathname !== "/") router.push("/");
            }}
          >
            <option value="manager">Knowledge Manager</option>
            <option value="member">Team Member</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-4 text-muted-foreground" />
        </div>
        {role === "manager" ? (
          <button
            type="button"
            onClick={resetDemo}
            disabled={resetting}
            className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
          >
            <RotateCcw className={cn("size-4", resetting && "animate-spin")} />
            {resetting ? "กำลังรีเซ็ต..." : "รีเซ็ตข้อมูล Demo"}
          </button>
        ) : null}
        <p role="status" className="min-h-5 px-1 pt-1 text-xs text-muted-foreground">
          {notice}
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden h-dvh border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/25"
            aria-label="ปิดเมนู"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(86vw,320px)] flex-col border-r bg-sidebar shadow-[4px_0_8px_oklch(0.19_0.015_24/0.12)]">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg hover:bg-muted"
            onClick={() => setMenuOpen(true)}
            aria-label="เปิดเมนู"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">น้องฟ้า · ICONIC</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
            Prototype
          </span>
        </header>
        <main className="min-h-[calc(100dvh-4rem)] lg:min-h-dvh">{children}</main>
      </div>
    </div>
  );
}
