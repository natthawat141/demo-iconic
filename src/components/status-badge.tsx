import { Archive, CheckCircle2, CircleDashed, Clock3, Send, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { GapStatus, KnowledgeStatus } from "@/lib/demo-types";

const knowledgeConfig = {
  draft: { label: "Draft", icon: CircleDashed, className: "bg-muted text-muted-foreground" },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-[oklch(0.95_0.035_150)] text-[oklch(0.30_0.08_150)]",
  },
  archived: { label: "Archived", icon: Archive, className: "bg-muted text-muted-foreground" },
} satisfies Record<KnowledgeStatus, { label: string; icon: typeof Archive; className: string }>;

const gapConfig = {
  new: { label: "ใหม่", icon: Clock3, className: "bg-[oklch(0.96_0.04_75)] text-[oklch(0.34_0.08_75)]" },
  escalated: { label: "ส่งต่อแล้ว", icon: Send, className: "bg-[oklch(0.95_0.035_225)] text-[oklch(0.34_0.08_235)]" },
  resolved: { label: "แก้ไขแล้ว", icon: CheckCircle2, className: "bg-[oklch(0.95_0.035_150)] text-[oklch(0.30_0.08_150)]" },
  dismissed: { label: "ปิดรายการ", icon: XCircle, className: "bg-muted text-muted-foreground" },
} satisfies Record<GapStatus, { label: string; icon: typeof Archive; className: string }>;

export function KnowledgeStatusBadge({ status }: { status: KnowledgeStatus }) {
  const config = knowledgeConfig[status];
  const Icon = config.icon;
  return (
    <Badge className={config.className}>
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

export function GapStatusBadge({ status }: { status: GapStatus }) {
  const config = gapConfig[status];
  const Icon = config.icon;
  return (
    <Badge className={config.className}>
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
