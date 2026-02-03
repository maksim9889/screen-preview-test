import { useState, useEffect } from "react";
import { isValidHexColor } from "../../lib/validation";
import { Label } from "../atoms/Label";

export interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    if (newValue && !newValue.startsWith("#")) {
      newValue = "#" + newValue;
    }
    setInputValue(newValue);

    if (isValidHexColor(newValue)) {
      setIsValid(true);
      onChange(newValue);
    } else {
      setIsValid(newValue === "" || newValue === "#");
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-1.5 items-center">
        <input
          type="color"
          value={isValidHexColor(inputValue) ? inputValue : "#000000"}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsValid(true);
            onChange(e.target.value);
          }}
          className="w-8 h-8 p-0 border border-gray-300 rounded cursor-pointer"
        />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="#000000"
          maxLength={7}
          className={`flex-1 px-2 py-1.5 border rounded text-xs font-mono uppercase text-gray-900 bg-white ${
            isValid ? "border-gray-300" : "border-red-400"
          }`}
        />
      </div>
      {!isValid && <p className="mt-1 text-xs text-red-500">Invalid hex color</p>}
    </div>
  );
}
