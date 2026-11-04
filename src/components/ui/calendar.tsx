"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ru } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import "react-day-picker/style.css";

function Calendar({ className, classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  return (
    <DayPicker
      locale={ru}
      showOutsideDays={showOutsideDays}
      className={cn("p-2 [--rdp-accent-color:var(--primary)] [--rdp-accent-background-color:var(--accent)]", className)}
      classNames={{
        today: cn("font-semibold text-primary"),
        selected: cn("rounded-md bg-primary text-primary-foreground"),
        chevron: cn("size-4"),
        button_previous: cn(buttonVariants({ variant: "ghost" }), "size-8 p-0"),
        button_next: cn(buttonVariants({ variant: "ghost" }), "size-8 p-0"),
        ...classNames,
      }}
      {...props}
    />
  );
}

export { Calendar };
