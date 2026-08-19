import { describe, expect, it } from "vitest";

import { classifyChatIntent, conversationalReply } from "@/lib/chat-intent";

describe("chat intent routing", () => {
  it.each(["Hi", "hello!", "สวัสดี", "สวัสดีครับ"]) (
    "handles greeting without retrieval: %s",
    (message) => {
      expect(conversationalReply(message)).toContain("สวัสดี");
    },
  );

  it("keeps a knowledge question in the retrieval path", () => {
    expect(conversationalReply("ลูกค้าไม่ตอบ ควรติดตามอย่างไร")).toBeNull();
  });

  it("answers identity questions without retrieval", () => {
    expect(conversationalReply("คุณคือใคร")).toContain("น้องฟ้า");
  });

  it("shows team work instead of Knowledge inventory for a generic system-help question", () => {
    const message = "ขอข้อมูลหน่อยอะไรที่ใช้ได้ในระบบ";
    expect(conversationalReply(message)).toContain("ติดตามลูกค้า");
    expect(conversationalReply(message)).toContain("วิเคราะห์ไฟล์งาน");
    expect(classifyChatIntent(message)).toBe("smalltalk");
  });

  it("keeps general definitions out of the team knowledge path", () => {
    expect(classifyChatIntent("API คืออะไร")).toBe("general");
  });

  it("forces internal system questions into the knowledge path", () => {
    expect(classifyChatIntent("API ของระบบเราใช้อย่างไร")).toBe("knowledge");
  });

  it("uses prior context to resolve a short follow-up", () => {
    expect(classifyChatIntent("API ล่ะ", "API ของระบบ ICONIC")).toBe("knowledge");
  });

  it("asks for clarification on an unresolved Thai follow-up", () => {
    expect(classifyChatIntent("แล้ว API ล่ะ?")).toBe("ambiguous");
  });

  it("keeps a chart request based on supplied data out of the Knowledge overview path", () => {
    expect(classifyChatIntent("ช่วยทำกราฟยอดขายจาก Excel นี้")).toBe("visualize");
  });

  it("routes an explicit Knowledge chart to the overview path", () => {
    expect(classifyChatIntent("ขอกราฟภาพรวม Knowledge")).toBe("overview");
  });

  it.each([
    "ช่วยค้นเว็บว่า Next.js รุ่นล่าสุดคืออะไร",
    "ข่าวเทคโนโลยีล่าสุดวันนี้",
    "search the web for current React release",
    "ค้นหาข้อมูล bill natthawat sawatdee ว่าเขาคือใคร",
    "หาข้อมูล nathawat sawatdee ได้ไหม",
  ])("routes fresh public information to Tavily: %s", (message) => {
    expect(classifyChatIntent(message)).toBe("web");
  });

  it("does not send ordinary internal questions to the public web", () => {
    expect(classifyChatIntent("แนวทางติดตามลูกค้าของทีมเรา")).toBe("knowledge");
    expect(classifyChatIntent("หาข้อมูลลูกค้าของทีมเรา")).toBe("knowledge");
  });
});
