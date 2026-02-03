import { Button } from "../atoms/Button";

export interface ImageListItemProps {
  url: string;
  index: number;
  onRemove: (index: number) => void;
}

export function ImageListItem({ url, index, onRemove }: ImageListItemProps) {
  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-white border border-gray-200 rounded">
      <img
        src={url}
        alt={`Slide ${index + 1}`}
        className="w-10 h-8 object-cover rounded bg-gray-200 flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/placeholder.svg";
        }}
      />
      <span className="flex-1 text-xs text-gray-500 truncate min-w-0">
        {url}
      </span>
      <button
        onClick={() => onRemove(index)}
        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded text-gray-500 hover:bg-red-50 hover:border-red-400 hover:text-red-500 flex-shrink-0 text-xs"
        aria-label={`Remove image ${index + 1}`}
      >
        ×
      </button>
    </div>
  );
}
