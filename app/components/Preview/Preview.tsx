import { useState, useEffect } from "react";
import type { AppConfig } from "../../lib/types";
import { CarouselPreview } from "./CarouselPreview";
import { TextPreview } from "./TextPreview";
import { CTAPreview } from "./CTAPreview";
import { DEFAULT_SECTION_ORDER } from "../../lib/constants";

interface PreviewProps {
  config: AppConfig;
  phoneWidth?: number;
  phoneHeight?: number;
  sectionOrder?: string[];
}

export default function Preview({
  config,
  phoneWidth = 390,
  phoneHeight = 844,
  sectionOrder = DEFAULT_SECTION_ORDER
}: PreviewProps) {
  const [scale, setScale] = useState(1);

  // Phone bezel adds about 24px to width (12px padding on each side)
  const bezelPadding = 24;

  // Calculate proportional height (screen height + notch + indicator + padding)
  const notchHeight = 28;
  const indicatorHeight = 16;
  const verticalPadding = 24;
  const totalHeight = phoneHeight + notchHeight + indicatorHeight + verticalPadding;

  // Calculate the bezel width proportionally
  const bezelWidth = phoneWidth + bezelPadding;

  // Calculate scale to fit viewport
  useEffect(() => {
    const calculateScale = () => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Leave some padding around the phone (48px top/bottom, account for size badge)
      const availableHeight = viewportHeight - 120;
      const availableWidth = viewportWidth - 48;

      const scaleByHeight = availableHeight / totalHeight;
      const scaleByWidth = availableWidth / bezelWidth;

      // Use the smaller scale to ensure it fits both dimensions, max 1
      const newScale = Math.min(scaleByHeight, scaleByWidth, 1);
      setScale(Math.max(0.5, newScale)); // Minimum scale of 0.5
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [totalHeight, bezelWidth]);

  // Map section IDs to preview components
  const sectionComponents = {
    carousel: (
      <CarouselPreview
        key="carousel"
        images={config.carousel.images}
        aspectRatio={config.carousel.aspectRatio}
      />
    ),
    textSection: (
      <TextPreview
        key="textSection"
        title={config.textSection.title}
        titleColor={config.textSection.titleColor}
        description={config.textSection.description}
        descriptionColor={config.textSection.descriptionColor}
      />
    ),
    cta: (
      <CTAPreview
        key="cta"
        label={config.cta.label}
        url={config.cta.url}
        backgroundColor={config.cta.backgroundColor}
        textColor={config.cta.textColor}
      />
    ),
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 gap-4">
      <div
        className="bg-gray-900 rounded-[40px] p-3 shadow-2xl transition-all duration-300 origin-center"
        style={{
          width: `${bezelWidth}px`,
          transform: `scale(${scale})`,
        }}
      >
        {/* Notch */}
        <div
          className="bg-gray-900 rounded-b-2xl mx-auto relative z-10"
          style={{
            width: `${Math.min(120, phoneWidth * 0.35)}px`,
            height: "28px",
          }}
        />

        {/* Screen */}
        <div
          className="bg-white rounded-[32px] overflow-hidden -mt-3.5"
          style={{
            width: `${phoneWidth}px`,
            height: `${phoneHeight}px`,
            maxWidth: "100%",
          }}
        >
          <div className="h-full overflow-y-auto">
            {sectionOrder.map((sectionId) =>
              sectionComponents[sectionId as keyof typeof sectionComponents]
            )}
          </div>
        </div>

        {/* Home Indicator */}
        <div
          className="bg-gray-500 rounded mx-auto mt-3 mb-1"
          style={{
            width: `${Math.min(120, phoneWidth * 0.35)}px`,
            height: "4px",
          }}
        />
      </div>

      {/* Size Info Badge */}
      <div className="bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-200">
        <p className="text-xs font-semibold text-gray-900 tracking-tight">
          {phoneWidth} × {phoneHeight}
        </p>
      </div>
    </div>
  );
}
