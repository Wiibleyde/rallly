import * as z from "zod";
import { pollExpiryDateSchema } from "@/features/poll/schema";
import { isExpiryDateInPast } from "@/features/poll/utils";

// A falsy poll timeZone means "floating". Clients historically sent "" for
// floating time polls; normalize it to null at the boundary so it can never
// be persisted. undefined must pass through untouched: in `modify` it means
// "leave the current value unchanged".
export const timeZoneInput = z
  .string()
  .transform((value) => value || null)
  .nullish();

// The last day the poll lives, as a calendar date. A date already behind us
// is refused so a stale or hand-built request can't delete a poll on the next
// clean-up run; the picker enforces the same floor.
export const expiryDateInput = pollExpiryDateSchema.refine(
  (value) => !isExpiryDateInPast(value),
  "The expiry date can't be in the past",
);
