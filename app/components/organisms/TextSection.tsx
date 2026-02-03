import { memo } from "react";
import type { AppConfig } from "../../lib/types";
import { FormField } from "../molecules/FormField";
import { ColorPicker } from "../molecules/ColorPicker";

export interface TextSectionProps {
  config: AppConfig;
  onUpdate: (updates: Partial<AppConfig["textSection"]>) => void;
}

function TextSectionComponent({ config, onUpdate }: TextSectionProps) {
  return (
    <div className="flex flex-col gap-3">

      <div className="flex flex-col gap-3">
        <FormField
          label="Title"
          type="text"
          value={config.textSection.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          inputSize="sm"
        />

        <ColorPicker
          label="Title Color"
          value={config.textSection.titleColor}
          onChange={(color) => onUpdate({ titleColor: color })}
        />

        <FormField
          label="Description"
          fieldType="textarea"
          value={config.textSection.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={3}
        />

        <ColorPicker
          label="Description Color"
          value={config.textSection.descriptionColor}
          onChange={(color) => onUpdate({ descriptionColor: color })}
        />
      </div>
    </div>
  );
}

export const TextSection = memo(TextSectionComponent);
