import { memo } from "react";
import type { AppConfig } from "../../lib/types";
import { FormField } from "../molecules/FormField";
import { ColorPicker } from "../molecules/ColorPicker";

export interface CTASectionProps {
  config: AppConfig;
  onUpdate: (updates: Partial<AppConfig["cta"]>) => void;
}

function CTASectionComponent({ config, onUpdate }: CTASectionProps) {
  return (
    <div className="flex flex-col gap-3">

      <div className="flex flex-col gap-3">
        <FormField
          label="Button Label"
          type="text"
          value={config.cta.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          inputSize="sm"
        />

        <FormField
          label="Button URL"
          type="text"
          value={config.cta.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://example.com"
          inputSize="sm"
        />

        <ColorPicker
          label="Background Color"
          value={config.cta.backgroundColor}
          onChange={(color) => onUpdate({ backgroundColor: color })}
        />

        <ColorPicker
          label="Text Color"
          value={config.cta.textColor}
          onChange={(color) => onUpdate({ textColor: color })}
        />
      </div>
    </div>
  );
}

export const CTASection = memo(CTASectionComponent);
