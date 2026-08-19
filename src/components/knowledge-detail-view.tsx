"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  MessageSquareShare,
  Printer,
  Share2,
  Sparkles,
  Tag,
  User,
} from "lucide-react";
import { useState } from "react";

import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KnowledgeItemDto } from "@/lib/demo-types";
import { KnowledgeStatusBadge } from "./status-badge";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function KnowledgeDetailView({ item }: { item: KnowledgeItemDto }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <div className="mx-auto max-w-[1020px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Top Navigation & Action Buttons */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div className="flex items-center gap-2">
          <Button
            render={<Link href="/knowledge" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> คลังความรู้
          </Button>
          <span className="text-muted-foreground">/</span>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {item.category}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyLink}
            className="h-9 gap-1.5"
          >
            <Copy className="size-3.5" />
            {copied ? "คัดลอกลิงก์แล้ว!" : "คัดลอกลิงก์"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5"
            title="พิมพ์หน้านี้"
          >
            <Printer className="size-3.5" /> พิมพ์
          </Button>

          <Button
            render={<Link href={`/knowledge/${item.id}/edit`} />}
            nativeButton={false}
            variant="default"
            size="sm"
            className="h-9 gap-1.5"
          >
            <Edit3 className="size-3.5" /> แก้ไข Knowledge
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Main Content Area */}
        <main className="min-w-0 space-y-6">
          {/* Article Header */}
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <KnowledgeStatusBadge status={item.status} />
              <span className="text-xs text-muted-foreground">
                ID: <code className="rounded bg-muted px-1.5 py-0.5">{item.id}</code>
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl text-foreground">
              {item.title}
            </h1>

            {/* Quick Meta Row */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-muted-foreground pt-1 border-b pb-4">
              <div className="flex items-center gap-1.5">
                <BookOpen className="size-3.5 text-primary" />
                <span>แหล่งที่มา: <strong className="font-semibold text-foreground">{item.sourceLabel}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="size-3.5 text-primary" />
                <span>เจ้าของความรู้: <strong className="font-semibold text-foreground">{item.ownerName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                <span>อัปเดตเมื่อ: <span className="text-foreground">{formatDate(item.updatedAt)}</span></span>
              </div>
            </div>
          </header>

          {/* Summary Card */}
          {item.summary && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-primary mb-2">
                <Sparkles className="size-4" /> สรุปสาระสำคัญ (Executive Summary)
              </div>
              <p className="text-sm font-medium leading-relaxed text-foreground">
                {item.summary}
              </p>
            </div>
          )}

          {/* Full Content Body */}
          <article className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xs">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                เนื้อหาและระเบียบปฏิบัติ
              </h2>
            </div>

            <MarkdownContent
              content={item.content}
              className="text-[15px] leading-7"
            />
          </article>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Tag className="size-3.5" /> แท็กที่เกี่ยวข้อง:
              </span>
              {item.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="rounded-lg px-2.5 py-0.5 text-xs font-normal"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </main>

        {/* Sidebar Info & Actions */}
        <aside className="space-y-5 lg:sticky lg:top-6 h-fit">
          {/* AI Governance Card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <CheckCircle2 className="size-4" /> AI RETRIEVAL STATUS
            </div>

            <div>
              <p className="text-sm font-bold text-foreground">
                {item.status === "approved"
                  ? "พร้อมใช้งานใน AI System"
                  : item.status === "draft"
                    ? "สถานะแบบร่าง (Draft)"
                    : "เก็บถาวร (Archived)"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.status === "approved"
                  ? "น้องฟ้าสามารถค้นหาและนำข้อมูลในหน้านี้ไปใช้อ้างอิงตอบคำถามทีมได้โดยอัตโนมัติ"
                  : item.status === "draft"
                    ? "ยังไม่ถูกนำไปตอบคำถามทีม ต้องผ่านการอนุมัติก่อน"
                    : "ปิดการใช้งานแล้ว น้องฟ้าจะไม่นำข้อมูลนี้ไปตอบ"}
              </p>
            </div>

            <div className="border-t pt-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">หมวดหมู่</span>
                <span className="font-semibold text-foreground">{item.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">วันที่สร้าง</span>
                <span className="text-foreground">{formatDate(item.createdAt)}</span>
              </div>
              {item.reviewDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ทบทวนครั้งถัดไป</span>
                  <span className="font-semibold text-primary">{formatDate(item.reviewDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Ask Nong Fah Action */}
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5 text-center space-y-3">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquareShare className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">ถามน้องฟ้าเกี่ยวกับเรื่องนี้</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ทดลองถาม AI เพื่อทดสอบการดึงข้อมูลจาก Knowledge นี้
              </p>
            </div>
            <Button
              render={<Link href={`/?q=${encodeURIComponent(item.title)}`} />}
              nativeButton={false}
              size="sm"
              className="w-full gap-1.5"
            >
              <Sparkles className="size-3.5" /> ถามน้องฟ้าทันที
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
