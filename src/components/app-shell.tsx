"use client";

import {
  Bot,
  ChevronDown,
  Database,
  FileBarChart,
  FolderOpen,
  LayoutDashboard,
  LibraryBig,
  ListTodo,
  LogOut,
  Menu,
  MessageSquareText,
  MessagesSquare,
  MoreHorizontal,
  Moon,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent, type PropsWithChildren } from "react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const memberNavigation = [
  { href: "/", label: "ผู้ช่วยความรู้", icon: MessageSquareText },
  { href: "/library", label: "คลังไฟล์", icon: FolderOpen },
];

const adminNavigation = [
  { href: "/admin", label: "ภาพรวมระบบ", icon: LayoutDashboard },
  { href: "/admin/users", label: "ผู้ใช้งาน", icon: UsersRound },
  { href: "/admin/conversations", label: "บทสนทนา", icon: MessagesSquare },
  { href: "/admin/files", label: "ไฟล์และข้อมูล", icon: FileBarChart },
  { href: "/admin/ai", label: "Admin AI", icon: MessageSquareText },
  { href: "/knowledge", label: "คลังความรู้", icon: LibraryBig },
  { href: "/gaps", label: "คำถามที่รอคำตอบ", icon: ListTodo },
];

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

async function requestConversationHistory() {
  const response = await fetch("/api/conversations", { cache: "no-store" });
  if (!response.ok) throw new Error("โหลดประวัติการสนทนาไม่สำเร็จ");
  const payload = await response.json() as { conversations?: ConversationSummary[] };
  return payload.conversations ?? [];
}

function historyTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function ConversationHistoryItem({
  conversation,
  onNavigate,
  onDelete,
}: {
  conversation: ConversationSummary;
  onNavigate: () => void;
  onDelete: (conversation: ConversationSummary) => void;
}) {
  const startX = useRef<number | null>(null);
  const [revealTime, setRevealTime] = useState(false);
  const suppressNavigation = useRef(false);

  function resetSwipe() {
    startX.current = null;
    setRevealTime(false);
  }

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    startX.current = event.clientX;
    suppressNavigation.current = false;
  }

  function handlePointerMove(event: PointerEvent<HTMLAnchorElement>) {
    if (startX.current === null) return;
    if (event.clientX - startX.current > 18) {
      suppressNavigation.current = true;
      setRevealTime(true);
    }
  }

  function handleClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (suppressNavigation.current) {
      event.preventDefault();
      suppressNavigation.current = false;
      return;
    }
    onNavigate();
  }

  return (
    <div className="group relative">
      <Link
      href={`/?conversation=${encodeURIComponent(conversation.id)}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={resetSwipe}
      onPointerCancel={resetSwipe}
      aria-label={`${conversation.title} · ${historyTimestamp(conversation.updatedAt)}`}
      className={cn(
        "relative flex min-h-10 w-full items-center overflow-hidden rounded-lg px-2.5 pr-13 text-left text-xs text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/25 touch-pan-y",
        revealTime && "bg-sidebar-accent/60",
      )}
      title={conversation.title}
      >
        <span className={cn("block min-w-0 flex-1 truncate transition-transform duration-150", revealTime && "translate-x-2")}>{conversation.title}</span>
        <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 translate-x-2 font-mono text-[10px] tabular-nums text-muted-foreground opacity-0 transition-all duration-150 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
          revealTime && "translate-x-0 opacity-100",
        )}
        >
          {historyTimestamp(conversation.updatedAt)}
        </span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`จัดการบทสนทนา ${conversation.title}`} />}
          className={cn(
            "absolute right-1 top-1/2 z-10 -translate-y-1/2 bg-sidebar opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100",
            revealTime && "pointer-events-none opacity-0",
          )}
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-32">
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(conversation)}>
            <Trash2 className="size-3.5" /> ลบแชต
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MemberConversationHistory({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshHistory = useCallback(async () => {
    try {
      const items = await requestConversationHistory();
      setConversations(items);
    } catch {
      // The chat itself remains available even if the history request is transiently unavailable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshHistory(), 0);
    const refresh = () => void refreshHistory();
    window.addEventListener("iconic:conversation-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("iconic:conversation-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshHistory]);

  function startNewConversation() {
    onNavigate();
    router.push(`/?new=${crypto.randomUUID()}`);
  }

  async function deleteConversation(conversation: ConversationSummary) {
    if (!window.confirm(`ลบบทสนทนา “${conversation.title}” หรือไม่? ข้อความในแชตนี้จะหายไป`)) return;
    const response = await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    if (!response.ok) return;
    const activeConversation = new URL(window.location.href).searchParams.get("conversation") === conversation.id;
    setConversations((current) => current.filter((item) => item.id !== conversation.id));
    window.dispatchEvent(new Event("iconic:conversation-updated"));
    if (activeConversation) router.push(`/?new=${crypto.randomUUID()}`);
  }

  return (
    <section className="mt-7" aria-label="บทสนทนาล่าสุด">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-[11px] font-semibold text-muted-foreground">บทสนทนาล่าสุด</p>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={startNewConversation} aria-label="เริ่มบทสนทนาใหม่" title="เริ่มแชตใหม่">
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-0.5" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">กำลังโหลด...</p>
        ) : conversations.length === 0 ? (
          <p className="px-2.5 py-2 text-xs leading-5 text-muted-foreground">เริ่มถามเพื่อเก็บบทสนทนาไว้ที่นี่</p>
        ) : conversations.map((conversation) => <ConversationHistoryItem key={conversation.id} conversation={conversation} onNavigate={onNavigate} onDelete={deleteConversation} />)}
      </div>
    </section>
  );
}

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/admin/settings")) return "การตั้งค่าระบบ";
  if (pathname.startsWith("/admin/users")) return "ผู้ใช้งานเดโม";
  if (pathname.startsWith("/admin/conversations")) return "บทสนทนาของทีม";
  if (pathname.startsWith("/admin/files")) return "ไฟล์และการวิเคราะห์";
  if (pathname.startsWith("/admin/ai")) return "Admin AI Workspace";
  if (pathname.startsWith("/admin")) return "ภาพรวมระบบ";
  if (pathname.startsWith("/knowledge/new")) return "เพิ่มความรู้";
  if (pathname.startsWith("/knowledge/")) return "รายละเอียดความรู้";
  if (pathname.startsWith("/knowledge")) return "คลังความรู้";
  if (pathname.startsWith("/gaps")) return "คำถามที่รอคำตอบ";
  if (pathname.startsWith("/library")) return "คลังไฟล์ของฉัน";
  return "ผู้ช่วยความรู้";
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      title={dark ? "โหมดสว่าง" : "โหมดมืด"}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function AppShell({
  children,
  modelId,
  liveModel,
  databaseLabel,
}: PropsWithChildren<{
  modelId: string;
  liveModel: boolean;
  databaseLabel: string;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState("");
  const adminMode =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/knowledge") ||
    pathname.startsWith("/gaps");

  if (pathname.startsWith("/login")) {
    return <main className="min-h-dvh bg-background">{children}</main>;
  }

  async function resetDemo() {
    if (!window.confirm("รีเซ็ตคลังความรู้และคำถามกลับเป็นข้อมูลเริ่มต้นหรือไม่?")) return;
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

  function logout() {
    window.sessionStorage.removeItem("iconic-demo-role");
    router.push("/login");
  }

  const navigation = adminMode ? adminNavigation : memberNavigation;
  const switchHref = adminMode ? "/" : "/admin";
  const sidebar = (
    <>
      <div className="flex h-15 items-center justify-between border-b border-sidebar-border/70 px-3">
        <Link
          href={adminMode ? "/admin" : "/"}
          className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_4px_8px_oklch(0.45_0.16_255/0.18)]">
            <Bot className="size-[1.05rem]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold leading-tight">Nong Fah</span>
            <span className="block truncate text-[11px] text-muted-foreground">ICONIC intelligence</span>
          </span>
        </Link>
        <Button type="button" variant="ghost" size="icon" className="size-9 md:hidden" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู">
          <X className="size-4.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {adminMode ? "ADMIN WORKSPACE" : "TEAM WORKSPACE"}
          </p>
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
        </div>
        <nav aria-label="เมนูหลัก" className="space-y-0.5">
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
                  "group flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/25",
                  current
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("size-4", current ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-foreground")} aria-hidden="true" />
                {item.label}
                {current ? <span className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
              </Link>
            );
          })}
        </nav>

        {!adminMode ? (
          <MemberConversationHistory onNavigate={() => setMenuOpen(false)} />
        ) : (
          <section className="mt-7 rounded-xl bg-sidebar-accent/55 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Database className="size-3.5 text-primary" />
              Data layer
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{databaseLabel}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-[oklch(0.62_0.15_150)]" />
              พร้อมใช้งาน
            </div>
          </section>
        )}
      </div>

      <div className="border-t border-sidebar-border p-2.5">
        {adminMode ? (
          <Button type="button" variant="ghost" onClick={resetDemo} disabled={resetting} className="mb-1 h-9 w-full justify-start px-2.5 text-xs text-muted-foreground hover:text-foreground">
            <RotateCcw className={cn("size-3.5", resetting && "animate-spin")} />
            {resetting ? "กำลังรีเซ็ต..." : "รีเซ็ตข้อมูลตัวอย่าง"}
          </Button>
        ) : null}
        <p role="status" className="px-2.5 text-[11px] text-muted-foreground">{notice}</p>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="ghost" className="mt-1 h-11 w-full justify-start gap-2.5 px-2 text-left" />}>
            <span className="flex size-8 items-center justify-center rounded-lg bg-background text-xs font-bold text-primary ring-1 ring-border">IC</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">ICONIC Team</span>
              <span className="block truncate text-[11px] text-muted-foreground">{adminMode ? "Project owner" : "Team member"}</span>
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={6} align="start">
            <DropdownMenuLabel>บัญชีสำหรับการสาธิต</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => router.push(switchHref)}>
              {adminMode ? <UserRound className="size-4" /> : <ShieldCheck className="size-4" />}
              {adminMode ? "กลับไปโหมดทีม" : "เปิดโหมดผู้ดูแล"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/admin/settings")}>
              <Settings2 className="size-4" /> การตั้งค่าระบบ
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive data-highlighted:text-destructive">
              <LogOut className="size-4" /> ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden h-dvh border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:flex-col">{sidebar}</aside>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-foreground/25" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} />
          <aside className="relative z-10 flex h-full w-[min(86vw,320px)] flex-col border-r bg-sidebar shadow-lg">{sidebar}</aside>
        </div>
      ) : null}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-15 items-center gap-3 border-b border-border/75 bg-background/95 px-3 backdrop-blur sm:px-5">
          <Button type="button" variant="ghost" size="icon" className="size-10 md:hidden" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู">
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{getPageTitle(pathname)}</p>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {adminMode ? "จัดการ Knowledge lifecycle และคุณภาพคำตอบ" : "ถาม ติดตาม และตรวจสอบแหล่งความรู้ของทีม"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden items-center gap-2 rounded-lg bg-muted/65 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground lg:flex">
              <span className={cn("size-1.5 rounded-full", liveModel ? "bg-[oklch(0.62_0.15_150)]" : "bg-muted-foreground")} />
              <span>OpenRouter</span><span className="text-border">/</span>
              <span className="max-w-56 truncate" title={modelId}>{modelId}</span>
            </div>
            <ThemeButton />
            <Button render={<Link href={switchHref} />} nativeButton={false} variant={adminMode ? "outline" : "secondary"} size="sm" className="hidden h-9 sm:flex">
              {adminMode ? <UserRound className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {adminMode ? "โหมดทีม" : "Admin"}
            </Button>
          </div>
        </header>
        <main className="workspace-canvas min-h-[calc(100dvh-3.75rem)]">{children}</main>
      </div>
    </div>
  );
}
