import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MaterialIcon } from "../atoms/MaterialIcon";
import type { ReactNode } from "react";

export interface SortableSectionWrapperProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function SortableSectionWrapper({
  id,
  title,
  children,
}: SortableSectionWrapperProps) {
  const [isExpanded, setIsExpanded] = useState(true);

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
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-gray-100 transition-colors"
        >
          <MaterialIcon
            icon="drag_indicator"
            size="small"
            className="text-gray-300"
          />
        </div>
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex-1">{title}</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          aria-label={isExpanded ? "Collapse section" : "Expand section"}
        >
          <MaterialIcon
            icon={isExpanded ? "expand_less" : "expand_more"}
            size="small"
            className="text-gray-400"
          />
        </button>
      </div>
      {isExpanded && (
        <div className="px-5 py-5">
          {children}
        </div>
      )}
    </section>
  );
}
