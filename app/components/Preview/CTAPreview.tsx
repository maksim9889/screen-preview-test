export interface CTAPreviewProps {
  label: string;
  url: string;
  backgroundColor: string;
  textColor: string;
}

export function CTAPreview({
  label,
  url,
  backgroundColor,
  textColor,
}: CTAPreviewProps) {
  return (
    <div className="p-4 flex justify-center">
      <a
        href={url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!url) e.preventDefault();
        }}
        className="inline-block px-8 py-3 rounded-lg text-base font-semibold text-center transition-all hover:opacity-90 hover:-translate-y-0.5"
        style={{ backgroundColor, color: textColor }}
      >
        {label || "Button"}
      </a>
    </div>
  );
}
