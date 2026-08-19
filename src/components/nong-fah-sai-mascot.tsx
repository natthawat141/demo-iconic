import Image from "next/image";

import { cn } from "@/lib/utils";

const mascotAssets = {
  welcome: "/mascot/nong-fah-sai-welcome-cutout.png",
  avatar: "/mascot/nong-fah-sai-avatar.png",
  library: "/mascot/nong-fah-sai-library.png",
} as const;

type NongFahSaiMascotProps = {
  variant: keyof typeof mascotAssets;
  className: string;
  priority?: boolean;
};

/** A decorative mascot image. Contextual text remains the accessible label. */
export function NongFahSaiMascot({ variant, className, priority = false }: NongFahSaiMascotProps) {
  return (
    <Image
      src={mascotAssets[variant]}
      alt=""
      aria-hidden="true"
      width={1024}
      height={1024}
      priority={priority}
      sizes="(max-width: 640px) 9rem, 10rem"
      className={cn("object-contain", className)}
    />
  );
}
