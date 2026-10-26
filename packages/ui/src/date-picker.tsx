"use client";

import type { CalendarDate } from "@internationalized/date";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import React from "react";
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker as DatePickerPrimitive,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Popover,
  Button as RAButton,
} from "react-aria-components";
import {
  fieldGroupClassName,
  isBidiIsolate,
  segmentClassName,
  triggerButtonClassName,
} from "./date-field-styles";
import { cn } from "./lib/utils";

export type DatePickerProps = {
  /** An ISO calendar date (`YYYY-MM-DD`), or null when empty. */
  value: string | null;
  /** Called with an ISO calendar date, or null once a segment is cleared. */
  onChange: (value: string | null) => void;
  /** Earliest selectable ISO date. Defaults to no limit. */
  minValue?: string;
  /** Makes today, in the viewer's time zone, the earliest selectable date. */
  disallowPast?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  firstDayOfWeek?: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

const cellClassName = cn(
  "flex size-8 cursor-pointer select-none items-center justify-center rounded-md text-sm outline-none",
  "hover:bg-accent",
  "data-[focus-visible]:ring-[3px] data-[focus-visible]:ring-ring/50",
  "data-[selected]:bg-primary/10 data-[selected]:text-primary",
  "data-[outside-month]:invisible",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "data-[unavailable]:pointer-events-none data-[unavailable]:line-through data-[unavailable]:opacity-50",
);

const navButtonClassName = cn(
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none",
  "hover:bg-accent hover:text-foreground",
  "data-[focus-visible]:ring-[3px] data-[focus-visible]:ring-ring/50",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);

/**
 * Accessible single date picker with segmented, fully styleable fields — each
 * date part is its own spinbutton (arrow keys, typeahead), so no native date
 * picker UI is involved. Takes and returns ISO date strings so callers never
 * touch react-aria's date types.
 */
function DatePicker({
  value,
  onChange,
  minValue,
  disallowPast,
  firstDayOfWeek,
  className,
  ...props
}: DatePickerProps) {
  // Read after mount: the clock must not be touched while rendering on the
  // server. The popover is closed until then, so nothing visible depends on it.
  const [currentDate, setCurrentDate] = React.useState<CalendarDate>();
  React.useEffect(() => {
    if (disallowPast) {
      setCurrentDate(today(getLocalTimeZone()));
    }
  }, [disallowPast]);

  const min = disallowPast
    ? currentDate
    : minValue
      ? parseDate(minValue)
      : undefined;

  return (
    <DatePickerPrimitive
      {...props}
      value={value ? parseDate(value) : null}
      onChange={(date) => onChange(date ? date.toString() : null)}
      minValue={min}
      firstDayOfWeek={firstDayOfWeek}
      className={cn("flex flex-col gap-2", className)}
    >
      <Group className={fieldGroupClassName}>
        <DateInput className="flex items-center">
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cn(
                segmentClassName,
                isBidiIsolate(segment.text) && "px-0",
              )}
            />
          )}
        </DateInput>
        <RAButton className={triggerButtonClassName}>
          <CalendarIcon className="size-4" />
        </RAButton>
      </Group>
      <Popover
        className={cn(
          "z-50 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md outline-none",
          "data-[entering]:fade-in-0 data-[entering]:animate-in",
          "data-[exiting]:fade-out-0 data-[exiting]:animate-out",
        )}
      >
        <Dialog className="outline-none">
          {/* firstDayOfWeek isn't forwarded from the picker to its calendar,
              so it has to be passed here too. */}
          <Calendar firstDayOfWeek={firstDayOfWeek}>
            <header className="relative flex items-center justify-between pb-3">
              <RAButton slot="previous" className={navButtonClassName}>
                <ChevronLeftIcon className="size-4" />
              </RAButton>
              <Heading className="font-medium text-sm" />
              <RAButton slot="next" className={navButtonClassName}>
                <ChevronRightIcon className="size-4" />
              </RAButton>
            </header>
            <CalendarGrid className="border-collapse">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="size-8 font-normal text-muted-foreground text-xs">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell date={date} className={cellClassName} />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePickerPrimitive>
  );
}

export { DatePicker };
