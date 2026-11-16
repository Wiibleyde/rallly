"use client";
import { cn } from "@rallly/ui";
import { UsersIcon } from "lucide-react";
import type { OptionCapacity } from "@/features/poll/utils";
import { Trans } from "@/i18n/client";

/**
 * Places taken on an option, or "Full" once none is left. Shown wherever an
 * option can be voted on, so the reason yes cannot be picked is in place.
 */
export function OptionCapacityBadge({
  capacity,
  compact = false,
  className,
}: {
  capacity: OptionCapacity | null;
  /** Count only, for cells too narrow for words; the color still says full. */
  compact?: boolean;
  className?: string;
}) {
  if (!capacity) {
    return null;
  }

  const isFull = capacity.taken >= capacity.max;

  return (
    <span
      data-testid="option-capacity"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 font-medium text-xs tabular-nums",
        isFull
          ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <UsersIcon className="size-3" aria-hidden="true" />
      {compact ? (
        <span>
          <span aria-hidden="true">
            {capacity.taken}/{capacity.max}
          </span>
          <span className="sr-only">
            {isFull ? (
              <Trans
                i18nKey="optionCapacityFull"
                defaults="Full ({taken}/{max})"
                values={{ taken: capacity.taken, max: capacity.max }}
              />
            ) : (
              <Trans
                i18nKey="optionCapacityPlaces"
                defaults="{taken}/{max} places"
                values={{ taken: capacity.taken, max: capacity.max }}
              />
            )}
          </span>
        </span>
      ) : isFull ? (
        <Trans
          i18nKey="optionCapacityFull"
          defaults="Full ({taken}/{max})"
          values={{ taken: capacity.taken, max: capacity.max }}
        />
      ) : (
        <Trans
          i18nKey="optionCapacityPlaces"
          defaults="{taken}/{max} places"
          values={{ taken: capacity.taken, max: capacity.max }}
        />
      )}
    </span>
  );
}
