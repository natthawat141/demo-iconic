import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface MarkdownContentProps extends ComponentPropsWithoutRef<"div"> {
  content: string;
}

export function MarkdownContent({ content, className, ...props }: MarkdownContentProps) {
  if (!content) return null;

  return (
    <div className={cn("markdown-content text-sm leading-relaxed", className)} {...props}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ className: headingClass, ...props }) => (
            <h1 className={cn("mt-4 mb-2 scroll-m-20 text-lg font-bold first:mt-0 last:mb-0", headingClass)} {...props} />
          ),
          h2: ({ className: headingClass, ...props }) => (
            <h2 className={cn("mt-3.5 mb-1.5 scroll-m-20 text-base font-bold first:mt-0 last:mb-0", headingClass)} {...props} />
          ),
          h3: ({ className: headingClass, ...props }) => (
            <h3 className={cn("mt-3 mb-1 scroll-m-20 text-sm font-bold first:mt-0 last:mb-0", headingClass)} {...props} />
          ),
          h4: ({ className: headingClass, ...props }) => (
            <h4 className={cn("mt-2.5 mb-1 scroll-m-20 text-sm font-semibold first:mt-0 last:mb-0", headingClass)} {...props} />
          ),
          h5: ({ className: headingClass, ...props }) => (
            <h5 className={cn("mt-2 mb-0.5 text-xs font-semibold uppercase tracking-wider first:mt-0 last:mb-0", headingClass)} {...props} />
          ),
          h6: ({ className: headingClass, ...props }) => (
            <h6 className={cn("mt-2 mb-0.5 text-xs font-medium uppercase tracking-wider first:mt-0 last:mb-0", headingClass)} {...props} />
          ),
          p: ({ className: pClass, ...props }) => (
            <p className={cn("my-2 leading-relaxed first:mt-0 last:mb-0", pClass)} {...props} />
          ),
          a: ({ className: aClass, href, ...props }) => {
            const isExternal = href?.startsWith("http");
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noreferrer noopener" : undefined}
                className={cn("text-primary underline underline-offset-2 hover:text-primary/80", aClass)}
                {...props}
              />
            );
          },
          blockquote: ({ className: bqClass, ...props }) => (
            <blockquote className={cn("my-2 border-s-2 border-muted-foreground/30 ps-3.5 text-muted-foreground italic", bqClass)} {...props} />
          ),
          ul: ({ className: ulClass, ...props }) => (
            <ul className={cn("my-2 ms-5 list-disc space-y-1 marker:text-muted-foreground [&>li]:mt-0.5", ulClass)} {...props} />
          ),
          ol: ({ className: olClass, ...props }) => (
            <ol className={cn("my-2 ms-5 list-decimal space-y-1 marker:text-muted-foreground [&>li]:mt-0.5", olClass)} {...props} />
          ),
          li: ({ className: liClass, ...props }) => (
            <li className={cn("leading-relaxed", liClass)} {...props} />
          ),
          strong: ({ className: strongClass, ...props }) => (
            <strong className={cn("font-semibold", strongClass)} {...props} />
          ),
          hr: ({ className: hrClass, ...props }) => (
            <hr className={cn("my-3 border-border", hrClass)} {...props} />
          ),
          table: ({ className: tblClass, ...props }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border">
              <table className={cn("w-full border-collapse text-xs", tblClass)} {...props} />
            </div>
          ),
          th: ({ className: thClass, ...props }) => (
            <th className={cn("border-b border-border bg-muted/60 px-3 py-2 text-start font-semibold text-foreground", thClass)} {...props} />
          ),
          td: ({ className: tdClass, ...props }) => (
            <td className={cn("border-b border-border/50 px-3 py-1.5 text-start last:border-b-0", tdClass)} {...props} />
          ),
          tr: ({ className: trClass, ...props }) => (
            <tr className={cn("last:border-b-0 hover:bg-muted/30 transition-colors", trClass)} {...props} />
          ),
          pre: ({ className: preClass, ...props }) => (
            <pre className={cn("my-2 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed", preClass)} {...props} />
          ),
          code: ({ className: codeClass, ...props }) => (
            <code className={cn("rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[0.85em]", codeClass)} {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
