import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface SegmentOption {
  value: string;
  label: string;
}

interface SegmentSelectorProps {
  label: string;
  options: SegmentOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function SegmentSelector({
  label,
  options,
  value,
  onChange,
  multiple = false,
  className,
}: SegmentSelectorProps) {
  const isSelected = (optionValue: string) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(optionValue);
    }
    return value === optionValue;
  };

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter((v) => v !== optionValue));
      } else {
        onChange([...currentValues, optionValue]);
      }
    } else {
      onChange(optionValue);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={isSelected(option.value) ? "default" : "outline"}
              size="sm"
              className={cn(
                "rounded-full whitespace-nowrap",
                isSelected(option.value) && "shadow-sm"
              )}
              onClick={() => handleSelect(option.value)}
              data-testid={`segment-${label.toLowerCase().replace(/\s+/g, "-")}-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
