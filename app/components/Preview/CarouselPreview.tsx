import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { AppConfig } from "../../lib/types";

export interface CarouselPreviewProps {
  images: string[];
  aspectRatio: AppConfig["carousel"]["aspectRatio"];
}

export function CarouselPreview({ images, aspectRatio }: CarouselPreviewProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index);
    },
    [emblaApi]
  );

  const aspectClass = {
    landscape: "aspect-video",
    portrait: "aspect-[9/16] max-h-[280px]",
    square: "aspect-square",
  }[aspectRatio];

  if (images.length === 0) {
    return (
      <div className={`w-full bg-gray-100 ${aspectClass}`}>
        <div className="w-full h-full min-h-[120px] flex items-center justify-center text-gray-400 text-sm">
          No images added
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full relative bg-gray-100 ${aspectClass}`}>
      <div className="overflow-hidden w-full h-full" ref={emblaRef}>
        <div className="flex h-full">
          {images.map((url, index) => (
            <div key={index} className="flex-none w-full h-full min-w-0">
              <img
                src={url}
                alt={`Slide ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === selectedIndex
                  ? "bg-white"
                  : "bg-white/50 hover:bg-white/75"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
