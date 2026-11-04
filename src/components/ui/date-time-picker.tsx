"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseLocal(value: string) {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function timeFromDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DateTimePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseLocal(value), [value]);

  function apply(date: Date) {
    onChange(toLocalValue(date));
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            data-empty={!selected}
            className={cn(
              "w-full justify-start text-left font-normal sm:flex-1 data-[empty=true]:text-muted-foreground",
            )}
          >
            <CalendarIcon />
            {selected ? format(selected, "d MMMM yyyy", { locale: ru }) : "Выберите дату"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) return;
              const next = new Date(date);
              if (selected) {
                next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
              } else {
                next.setHours(9, 0, 0, 0);
              }
              apply(next);
            }}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        step={60}
        value={selected ? timeFromDate(selected) : ""}
        disabled={!selected}
        aria-label="Время"
        onChange={(event) => {
          if (!selected || !event.target.value) return;
          const [hours, minutes] = event.target.value.split(":").map(Number);
          const next = new Date(selected);
          next.setHours(hours || 0, minutes || 0, 0, 0);
          apply(next);
        }}
        className="bg-background appearance-none sm:w-[148px] [&::-webkit-calendar-picker-indicator]:opacity-70"
      />
      {selected ? (
        <Button type="button" variant="ghost" onClick={() => onChange("")}>
          Сбросить
        </Button>
      ) : null}
    </div>
  );
}
