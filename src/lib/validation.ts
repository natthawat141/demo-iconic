import { z } from "zod";

export const knowledgeInputSchema = z.object({
  title: z.string().trim().min(3, "กรุณาระบุชื่อ Knowledge"),
  summary: z.string().trim().min(8, "กรุณาเขียนสรุปสั้น ๆ"),
  content: z.string().trim().min(12, "เนื้อหาต้องมีอย่างน้อย 12 ตัวอักษร"),
  category: z.string().trim().min(2, "กรุณาระบุหมวดหมู่"),
  tags: z.array(z.string().trim().min(1)).max(10).default([]),
  sourceLabel: z.string().trim().min(3, "กรุณาระบุแหล่งที่มา"),
  ownerName: z.string().trim().min(2, "กรุณาระบุเจ้าของความรู้"),
  reviewDate: z.string().nullable().optional(),
});

export const knowledgePatchSchema = knowledgeInputSchema.partial();

