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

  it("keeps general definitions out of the team knowledge path", () => {
    expect(classifyChatIntent("API คืออะไร")).toBe("general");
  });

  it("forces internal system questions into the knowledge path", () => {
    expect(classifyChatIntent("API ของระบบเราใช้อย่างไร")).toBe("knowledge");
  });

  it("uses prior context to resolve a short follow-up", () => {
    expect(classifyChatIntent("API ล่ะ", "API ของระบบ ICONIC")).toBe("knowledge");
  });

  it("keeps a chart request based on supplied data out of the Knowledge overview path", () => {
    expect(classifyChatIntent("ช่วยทำกราฟยอดขายจาก Excel นี้")).toBe("visualize");
  });

  it("routes an explicit Knowledge chart to the overview path", () => {
    expect(classifyChatIntent("ขอกราฟภาพรวม Knowledge")).toBe("overview");
  });
});
