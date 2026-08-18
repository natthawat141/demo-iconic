import { cn } from "@/lib/utils";

type AiLoaderProps = {
  className?: string;
  decorative?: boolean;
  label?: string;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: "size-4",
  md: "size-5",
};

export function AiLoader({
  className,
  decorative = false,
  label = "กำลังประมวลผล",
  size = "sm",
}: AiLoaderProps) {
  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      className={cn("relative inline-grid shrink-0 place-items-center", sizeClasses[size], className)}
      role={decorative ? undefined : "status"}
    >
      <span className="absolute inset-0 rounded-full border border-primary/25 border-t-primary motion-safe:animate-spin [animation-duration:0.9s]" />
      <span className="absolute inset-[0.19rem] rounded-full border border-primary/15 border-b-primary/65 motion-safe:animate-spin [animation-direction:reverse] [animation-duration:1.35s]" />
      <span className="size-1 rounded-full bg-primary motion-safe:animate-pulse" />
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}
