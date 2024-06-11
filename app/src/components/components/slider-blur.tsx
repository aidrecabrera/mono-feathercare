import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import React from "react";

type SliderProps = React.ComponentProps<typeof Slider>;

export function SliderBlur({ className, ...props }: SliderProps) {
  return (
    <Slider
      defaultValue={[props.defaultValue?.[0] ?? 8]}
      max={props.max || 50}
      step={props.step || 1}
      className={cn("w-[60%]", className)}
      {...props}
    />
  );
}
