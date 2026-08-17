export type KnowledgeStatus = "draft" | "approved" | "archived";
export type GapStatus = "new" | "escalated" | "resolved" | "dismissed";

export type KnowledgeInput = {
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  sourceLabel: string;
  ownerName: string;
  reviewDate?: string | null;
};

export type KnowledgeStateData = {
  state: "grounded" | "insufficient" | "fixture";
  label: string;
  gapId?: string;
};

export type TabularAnalysisData = {
  fileId: string;
  filename: string;
  analysis: {
    selectedSheet: {
      name: string;
      rowCount: number;
      columnCount: number;
      columns?: Array<{ name: string; kind: string }>;
      previewRows?: string[][];
    };
    chart: {
      kind: "bar" | "line";
      title: string;
      points: Array<{ label: string; value: number }>;
    } | null;
    breakdowns?: Array<{
      labelColumn: string;
      valueColumn: string;
      aggregation: "sum";
      points: Array<{ label: string; value: number }>;
    }>;
    caveats: string[];
  };
};

export type KnowledgeItemDto = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  sourceLabel: string;
  ownerName: string;
  status: KnowledgeStatus;
  reviewDate: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeGapDto = {
  id: string;
  question: string;
  count: number;
  status: GapStatus;
  firstAskedAt: string;
  lastAskedAt: string;
  resolvedKnowledgeItemId: string | null;
};
