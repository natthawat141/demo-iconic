"use client";

import {
  Layers3,
  LibraryBig,
  ListTodo,
  Menu,
  MessageSquareText,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type PropsWithChildren } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "ผู้ช่วยความรู้", icon: MessageSquareText },
  { href: "/knowledge", label: "คลังความรู้", icon: LibraryBig },
  { href: "/gaps", label: "คำถามที่รอคำตอบ", icon: ListTodo },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/knowledge/new")) return "เพิ่มความรู้";
  if (pathname.startsWith("/knowledge/")) return "รายละเอียดความรู้";
  if (pathname.startsWith("/knowledge")) return "คลังความรู้";
  if (pathname.startsWith("/gaps")) return "คำถามที่รอคำตอบ";
  return "ผู้ช่วยความรู้";
}

export function AppShell({
  children,
  modelId,
  liveModel,
}: PropsWithChildren<{ modelId: string; liveModel: boolean }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState("");

  async function resetDemo() {
    if (!window.confirm("รีเซ็ตคลังความรู้และคำถามกลับเป็นข้อมูลเริ่มต้นหรือไม่?")) {
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
    setNotice("รีเซ็ตข้อมูลตัวอย่างแล้ว");
    router.refresh();
  }

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers3 className="size-[1.125rem]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold leading-tight">Nong Fah</span>
            <span className="block truncate text-xs text-muted-foreground">ICONIC Knowledge</span>
          </span>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="ปิดเมนู"
        >
          <X className="size-5" />
        </Button>
      </div>

      <nav aria-label="เมนูหลัก" className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const current = isCurrent(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/25",
                  current
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground",
                )}
              >
                <Icon
                  className={cn("size-[1.125rem]", current && "text-sidebar-primary")}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-background text-xs font-bold text-primary ring-1 ring-border">
            IC
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">ICONIC Team</span>
            <span className="block truncate text-xs text-muted-foreground">Knowledge workspace</span>
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={resetDemo}
          disabled={resetting}
          className="mt-1 h-10 w-full justify-start px-3 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className={cn("size-4", resetting && "animate-spin")} />
          {resetting ? "กำลังรีเซ็ต..." : "รีเซ็ตข้อมูลตัวอย่าง"}
        </Button>
        <p role="status" className="min-h-5 px-3 pt-1 text-xs text-muted-foreground">
          {notice}
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[224px_1fr]">
      <aside className="hidden h-dvh border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:flex-col">
        {sidebar}
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/25"
            aria-label="ปิดเมนู"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(86vw,320px)] flex-col border-r bg-sidebar shadow-lg">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="flex h-14 items-center gap-3 border-b border-border/80 bg-background px-4 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="เปิดเมนู"
          >
            <Menu className="size-5" />
          </Button>
          <p className="truncate text-sm font-semibold">{getPageTitle(pathname)}</p>
          <div className="ml-auto hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:flex">
            <span
              className={cn(
                "size-1.5 rounded-full",
                liveModel ? "bg-[oklch(0.55_0.14_150)]" : "bg-muted-foreground",
              )}
              aria-hidden="true"
            />
            <span>OpenRouter</span>
            <span className="text-border">/</span>
            <span className="max-w-64 truncate" title={modelId}>{modelId}</span>
          </div>
        </header>
        <main className="min-h-[calc(100dvh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}
