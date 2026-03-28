"use client";

import Image from "next/image";

export function DocFigure({
  src,
  alt,
  caption,
  className,
}: {
  src: string;
  alt: string;
  caption: string;
  className?: string;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/80 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.85)] ${className ?? ""}`}
    >
      <div className="relative w-full bg-zinc-950">
        <Image
          src={src}
          alt={alt}
          width={1600}
          height={1000}
          className="h-auto w-full max-w-full object-contain"
          sizes="(max-width: 1152px) 100vw, 896px"
          unoptimized
        />
      </div>
      <figcaption className="border-t border-white/[0.06] px-4 py-3.5 text-center text-sm leading-snug text-zinc-400 sm:px-6 sm:text-base">
        {caption}
      </figcaption>
    </figure>
  );
}
