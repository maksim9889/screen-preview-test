import { useState, memo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { AppConfig } from "../../lib/types";
import { isValidUrl } from "../../lib/validation";
import { FormField } from "../molecules/FormField";
import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { SortableImageItem } from "../molecules/SortableImageItem";

export interface CarouselSectionProps {
  config: AppConfig;
  onUpdate: (updates: Partial<AppConfig["carousel"]>) => void;
}

function CarouselSectionComponent({ config, onUpdate }: CarouselSectionProps) {
  const [newImageUrl, setNewImageUrl] = useState("");
  const [imageError, setImageError] = useState("");

  const handleAddImage = () => {
    if (!newImageUrl.trim()) {
      setImageError("URL is required");
      return;
    }
    if (!isValidUrl(newImageUrl)) {
      setImageError("Please enter a valid URL");
      return;
    }
    onUpdate({ images: [...config.carousel.images, newImageUrl] });
    setNewImageUrl("");
    setImageError("");
  };

  const handleRemoveImage = (index: number) => {
    onUpdate({
      images: config.carousel.images.filter((_, i) => i !== index),
    });
  };

  const handleEditImage = (index: number, newUrl: string) => {
    const newImages = [...config.carousel.images];
    newImages[index] = newUrl;
    onUpdate({ images: newImages });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = config.carousel.images.findIndex((url, i) => `image-${i}-${url}` === active.id);
      const newIndex = config.carousel.images.findIndex((url, i) => `image-${i}-${url}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onUpdate({
          images: arrayMove(config.carousel.images, oldIndex, newIndex),
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">

      <div className="mb-3">
        <FormField
          label="Aspect Ratio"
          fieldType="select"
          value={config.carousel.aspectRatio}
          onChange={(e) =>
            onUpdate({
              aspectRatio: e.target.value as AppConfig["carousel"]["aspectRatio"],
            })
          }
        >
          <option value="landscape">Landscape (16:9)</option>
          <option value="portrait">Portrait (9:16)</option>
          <option value="square">Square (1:1)</option>
        </FormField>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Images ({config.carousel.images.length})
        </label>

        <DndContext
          id="carousel-images-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={config.carousel.images.map((url, i) => `image-${i}-${url}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2 mb-2">
              {config.carousel.images.map((url, index) => (
                <SortableImageItem
                  key={`image-${index}-${url}`}
                  id={`image-${index}-${url}`}
                  url={url}
                  index={index}
                  onRemove={handleRemoveImage}
                  onEdit={handleEditImage}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex gap-1.5">
          <Input
            type="text"
            value={newImageUrl}
            onChange={(e) => {
              setNewImageUrl(e.target.value);
              setImageError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleAddImage()}
            placeholder="Image URL..."
            error={!!imageError}
            inputSize="sm"
            className="flex-1"
          />
          <Button onClick={handleAddImage} variant="primary" size="sm">
            Add
          </Button>
        </div>
        {imageError && <p className="mt-1 text-xs text-red-500">{imageError}</p>}
      </div>
    </div>
  );
}

export const CarouselSection = memo(CarouselSectionComponent);
