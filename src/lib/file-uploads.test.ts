import { describe, expect, it } from "vitest";

import { classifyUpload } from "@/lib/file-uploads";

describe("upload file classification", () => {
  it("uses the approved extension when Windows reports a generic MIME type", () => {
    expect(classifyUpload({
      name: "same-file-name.png",
      type: "application/octet-stream",
      size: 1024,
    })).toEqual({ kind: "image", mediaType: "image/png" });
  });

  it("does not need a unique display filename", () => {
    const first = classifyUpload({ name: "report.pdf", type: "application/pdf", size: 1024 });
    const second = classifyUpload({ name: "report.pdf", type: "application/pdf", size: 1024 });

    expect(first).toEqual(second);
  });
});
