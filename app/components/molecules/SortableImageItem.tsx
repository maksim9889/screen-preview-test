import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MaterialIcon } from "../atoms/MaterialIcon";
import { isValidUrl } from "../../lib/validation";

export interface SortableImageItemProps {
  id: string;
  url: string;
  index: number;
  onRemove: (index: number) => void;
  onEdit?: (index: number, newUrl: string) => void;
}

export function SortableImageItem({
  id,
  url,
  index,
  onRemove,
  onEdit,
}: SortableImageItemProps) {
  const [imageError, setImageError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(url);
  const [editError, setEditError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(index);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditValue(url);
    setEditError("");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmedUrl = editValue.trim();
    if (!trimmedUrl) {
      setEditError("URL is required");
      return;
    }
    if (!isValidUrl(trimmedUrl)) {
      setEditError("Please enter a valid URL");
      return;
    }
    if (trimmedUrl !== url && onEdit) {
      onEdit(index, trimmedUrl);
      setImageError(false); // Reset error state for new URL
    }
    setIsEditing(false);
    setEditError("");
  };

  const handleCancelEdit = () => {
    setEditValue(url);
    setIsEditing(false);
    setEditError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-white border rounded hover:shadow-md transition-shadow ${
        imageError ? "border-red-300 bg-red-50" : "border-gray-200"
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <MaterialIcon icon="drag_indicator" size="small" className="text-gray-400" />
      </div>
      {imageError ? (
        <div className="w-12 h-10 flex items-center justify-center rounded bg-red-100 flex-shrink-0">
          <MaterialIcon icon="broken_image" size="small" className="text-red-400" />
        </div>
      ) : (
        <img
          src={url}
          alt={`Slide ${index + 1}`}
          className="w-12 h-10 object-cover rounded bg-gray-200 flex-shrink-0"
          onError={() => setImageError(true)}
        />
      )}
      {isEditing ? (
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                setEditError("");
              }}
              onKeyDown={handleKeyDown}
              className={`flex-1 text-xs px-2 py-1 border rounded min-w-0 ${
                editError ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder="Image URL..."
            />
            <button
              onClick={handleSaveEdit}
              type="button"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-green-50 flex-shrink-0 transition-colors"
              aria-label="Save URL"
            >
              <MaterialIcon icon="check" size="small" className="text-green-600" />
            </button>
            <button
              onClick={handleCancelEdit}
              type="button"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0 transition-colors"
              aria-label="Cancel edit"
            >
              <MaterialIcon icon="close" size="small" className="text-gray-500" />
            </button>
          </div>
          {editError && <span className="text-xs text-red-500">{editError}</span>}
        </div>
      ) : (
        <>
          <span className={`flex-1 text-xs truncate min-w-0 ${imageError ? "text-red-600" : "text-gray-600"}`}>
            {url}
          </span>
          {onEdit && (
            <button
              onClick={handleStartEdit}
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-50 flex-shrink-0 transition-colors"
              aria-label={`Edit image ${index + 1} URL`}
            >
              <MaterialIcon icon="edit" size="small" className="text-gray-400 hover:text-blue-600" />
            </button>
          )}
          <button
            onClick={handleRemove}
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-600 flex-shrink-0 transition-colors"
            aria-label={`Remove image ${index + 1}`}
          >
            <MaterialIcon icon="delete" size="small" className="text-gray-400 hover:text-red-600" />
          </button>
        </>
      )}
    </div>
  );
}
