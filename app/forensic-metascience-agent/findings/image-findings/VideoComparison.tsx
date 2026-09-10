"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

export function VideoComparison({ embedUrl, videoUrl, title }: {
  embedUrl: string;
  videoUrl: string;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="mt-5 mx-auto max-w-2xl">
      <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
        {playing ? (
          <iframe
            src={`${embedUrl}&autoplay=1`}
            title={`Image comparison for ${title}`}
            width="672"
            height="378"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video comparison for ${title}`}
            className="group absolute inset-0 flex h-full w-full items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
          >
            <Image
              src="https://i.ytimg.com/vi/DkbadA497Eo/hqdefault.jpg"
              alt="Preview of the comparison between Figure 1 and Figure 6"
              fill
              sizes="(max-width: 720px) 100vw, 672px"
              unoptimized
              className="object-cover"
            />
            <span className="relative flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-medium text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              Play comparison
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        Figures 1 and 6 ·{" "}
        <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Watch on YouTube</a>
      </figcaption>
    </figure>
  );
}
