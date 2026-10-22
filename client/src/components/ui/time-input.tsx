import React from "react";
import { Input } from "@/components/ui/input";

interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function TimeInput({ value, onChange, className, ...props }: TimeInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <Input
      type="time"
      value={value}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
}
