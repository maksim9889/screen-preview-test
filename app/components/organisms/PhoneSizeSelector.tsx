import { useState } from "react";
import { Select } from "../atoms/Select";
import { Input } from "../atoms/Input";
import { Button } from "../atoms/Button";
import {
  PHONE_MODELS,
  SCREEN_RESOLUTIONS,
  DEFAULT_PHONE_SIZE,
  findPhoneModelByName,
  findResolutionByName,
  validateDimensions,
} from "../../lib/phone-presets";

export interface PhoneSizeSelectorProps {
  currentWidth: number;
  currentHeight: number;
  onSizeChange: (width: number, height: number) => void;
}

type SelectorMode = "phone-model" | "resolution" | "custom";

export function PhoneSizeSelector({
  currentWidth,
  currentHeight,
  onSizeChange,
}: PhoneSizeSelectorProps) {
  const [mode, setMode] = useState<SelectorMode>("phone-model");
  const [customWidth, setCustomWidth] = useState(String(currentWidth));
  const [customHeight, setCustomHeight] = useState(String(currentHeight));
  const [error, setError] = useState("");

  const handleModeChange = (newMode: SelectorMode) => {
    setMode(newMode);
    setError("");
  };

  const handlePhoneModelChange = (modelName: string) => {
    const model = findPhoneModelByName(modelName);
    if (model) {
      onSizeChange(model.width, model.height);
      setError("");
    }
  };

  const handleResolutionChange = (resolutionName: string) => {
    const resolution = findResolutionByName(resolutionName);
    if (resolution) {
      onSizeChange(resolution.width, resolution.height);
      setError("");
    }
  };

  const handleCustomApply = () => {
    const width = parseInt(customWidth, 10);
    const height = parseInt(customHeight, 10);

    if (isNaN(width) || isNaN(height)) {
      setError("Please enter valid numbers");
      return;
    }

    if (!validateDimensions(width, height)) {
      setError("Width must be 280-500px, height must be 500-1000px");
      return;
    }

    onSizeChange(width, height);
    setError("");
  };

  const handleReset = () => {
    onSizeChange(DEFAULT_PHONE_SIZE.width, DEFAULT_PHONE_SIZE.height);
    setCustomWidth(String(DEFAULT_PHONE_SIZE.width));
    setCustomHeight(String(DEFAULT_PHONE_SIZE.height));
    setError("");
  };

  // Group phone models by category
  const groupedModels = PHONE_MODELS.reduce((acc, model) => {
    if (!acc[model.category]) {
      acc[model.category] = [];
    }
    acc[model.category].push(model);
    return acc;
  }, {} as Record<string, typeof PHONE_MODELS>);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-lg">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 tracking-tight">Phone Size</h3>

      {/* Mode Selector */}
      <div className="flex gap-2 mb-4">
        <Button
          size="xs"
          variant={mode === "phone-model" ? "primary" : "ghost"}
          onClick={() => handleModeChange("phone-model")}
          className="flex-1"
        >
          Model
        </Button>
        <Button
          size="xs"
          variant={mode === "resolution" ? "primary" : "ghost"}
          onClick={() => handleModeChange("resolution")}
          className="flex-1"
        >
          Resolution
        </Button>
        <Button
          size="xs"
          variant={mode === "custom" ? "primary" : "ghost"}
          onClick={() => handleModeChange("custom")}
          className="flex-1"
        >
          Custom
        </Button>
      </div>

      {/* Phone Model Selector */}
      {mode === "phone-model" && (
        <div className="space-y-2">
          <Select
            value=""
            onChange={(e) => handlePhoneModelChange(e.target.value)}
            className="text-xs"
          >
            <option value="">Select a phone model...</option>
            {Object.entries(groupedModels).map(([category, models]) => (
              <optgroup key={category} label={category}>
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name} ({model.width}×{model.height})
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
      )}

      {/* Resolution Selector */}
      {mode === "resolution" && (
        <div className="space-y-2">
          <Select
            value=""
            onChange={(e) => handleResolutionChange(e.target.value)}
            className="text-xs"
          >
            <option value="">Select a resolution...</option>
            {SCREEN_RESOLUTIONS.map((res) => (
              <option key={res.name} value={res.name}>
                {res.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Custom Size Input */}
      {mode === "custom" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Width</label>
              <Input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                placeholder="390"
                inputSize="sm"
                min={280}
                max={500}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Height</label>
              <Input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                placeholder="844"
                inputSize="sm"
                min={500}
                max={1000}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button
            onClick={handleCustomApply}
            variant="primary"
            size="sm"
            fullWidth
          >
            Apply
          </Button>
        </div>
      )}

      {/* Current Size Display */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="text-xs text-gray-600">
          Current: <span className="font-semibold text-gray-900">{currentWidth}×{currentHeight}</span>
        </div>
        <Button onClick={handleReset} variant="ghost" size="xs">
          Reset
        </Button>
      </div>
    </div>
  );
}
