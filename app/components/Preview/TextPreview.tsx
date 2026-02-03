export interface TextPreviewProps {
  title: string;
  titleColor: string;
  description: string;
  descriptionColor: string;
}

export function TextPreview({
  title,
  titleColor,
  description,
  descriptionColor,
}: TextPreviewProps) {
  return (
    <div className="p-4 text-center">
      <h2
        className="text-xl font-semibold mb-2 leading-tight"
        style={{ color: titleColor }}
      >
        {title || "Title goes here"}
      </h2>
      <p className="text-sm leading-relaxed" style={{ color: descriptionColor }}>
        {description || "Description goes here"}
      </p>
    </div>
  );
}
