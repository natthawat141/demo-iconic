import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary font-mono text-xs font-semibold text-primary-foreground">NF</span>
            <div><p className="font-bold">Nong Fah</p><p className="text-xs text-muted-foreground">ICONIC intelligence workspace</p></div>
          </div>
          <div className="mt-12">
            <p className="font-mono text-xs text-primary">DEMO ACCESS</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">เข้าสู่ Knowledge workspace</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">สมัครหรือเข้าสู่ระบบเพื่อให้ประวัติแชต ไฟล์ และการใช้งานโมเดลผูกกับบัญชีของคุณ</p>
          </div>
          <div className="mt-8 space-y-3">
            <Show when="signed-out">
              <SignInButton mode="modal"><Button type="button" size="lg" className="h-12 w-full justify-between px-4"><span className="flex items-center gap-2"><UserRound className="size-4" /> เข้าสู่ระบบ</span><ArrowRight className="size-4" /></Button></SignInButton>
              <SignUpButton mode="modal"><Button type="button" variant="outline" size="lg" className="mt-3 h-12 w-full justify-between px-4"><span className="flex items-center gap-2"><ShieldCheck className="size-4" /> สมัครใช้เดโม</span><ArrowRight className="size-4" /></Button></SignUpButton>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-3 rounded-xl border border-border p-3"><UserButton appearance={{ elements: { avatarBox: "size-9" } }} /><p className="flex-1 text-sm font-medium">บัญชีพร้อมใช้งานแล้ว</p></div>
              <Button render={<Link href="/" />} nativeButton={false} size="lg" className="mt-3 h-12 w-full justify-between px-4"><span className="flex items-center gap-2"><UserRound className="size-4" /> ไปที่แชต</span><ArrowRight className="size-4" /></Button>
            </Show>
          </div>
        </div>
      </section>
      <section className="hidden overflow-hidden bg-[oklch(0.18_0.035_255)] p-10 text-[oklch(0.94_0.01_255)] lg:flex lg:flex-col lg:justify-between">
        <div className="font-mono text-xs text-[oklch(0.72_0.11_250)]">ICONIC / KNOWLEDGE OPERATING SYSTEM</div>
        <div className="max-w-xl">
          <p className="text-4xl font-semibold leading-tight tracking-[-0.04em]">ความรู้ของทีมควรค้นเจอ อ้างอิงได้ และดีขึ้นทุกครั้งที่มีคำถามใหม่</p>
          <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/15">
            {["Grounded answers", "Human review", "Knowledge gaps"].map((label) => <div key={label} className="bg-[oklch(0.18_0.035_255)] p-4 text-xs text-white/65">{label}</div>)}
          </div>
        </div>
      </section>
    </div>
  );
}
