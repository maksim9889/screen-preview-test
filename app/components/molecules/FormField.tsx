import { Label } from "../atoms/Label";
import { Input, type InputProps } from "../atoms/Input";
import { Textarea } from "../atoms/Textarea";
import { Select } from "../atoms/Select";
import type { ReactNode, ChangeEvent } from "react";

/**
 * Union type for form element change events
 * Used to provide a single onChange handler for Input, Textarea, and Select
 */
type FormElementChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

/**
 * Type-safe onChange handlers for each element type
 * These are compatible with the union FormElementChangeEvent
 */
type InputChangeHandler = (e: ChangeEvent<HTMLInputElement>) => void;
type TextareaChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => void;
type SelectChangeHandler = (e: ChangeEvent<HTMLSelectElement>) => void;

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  fieldType?: "input" | "textarea" | "select";
  children?: ReactNode; // For select options
  rows?: number; // For textarea
  id?: string;
  value?: string | number | readonly string[];
  onChange?: (e: FormElementChangeEvent) => void;
  placeholder?: string;
  inputSize?: InputProps["inputSize"];
  type?: string;
  autoFocus?: boolean;
  maxLength?: number;
  disabled?: boolean;
  name?: string;
  className?: string;
}

export function FormField({
  label,
  error,
  required = false,
  fieldType = "input",
  children,
  rows,
  id,
  value,
  onChange,
  placeholder,
  inputSize,
  type,
  autoFocus,
  maxLength,
  disabled,
  name,
  className,
}: FormFieldProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "-");
  const hasError = !!error;

  return (
    <div className="flex flex-col">
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      {fieldType === "input" && (
        <Input
          id={fieldId}
          error={hasError}
          inputSize={inputSize}
          value={value}
          onChange={onChange as InputChangeHandler}
          placeholder={placeholder}
          type={type}
          autoFocus={autoFocus}
          maxLength={maxLength}
          disabled={disabled}
          name={name}
          className={className}
        />
      )}
      {fieldType === "textarea" && (
        <Textarea
          id={fieldId}
          error={hasError}
          rows={rows}
          value={value}
          onChange={onChange as TextareaChangeHandler}
          placeholder={placeholder}
          disabled={disabled}
          name={name}
          className={className}
        />
      )}
      {fieldType === "select" && (
        <Select
          id={fieldId}
          error={hasError}
          value={value}
          onChange={onChange as SelectChangeHandler}
          disabled={disabled}
          name={name}
          className={className}
        >
          {children}
        </Select>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
