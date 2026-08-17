import { describe, expect, it } from "vitest";

import { conversationalReply } from "@/lib/chat-intent";

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
});
