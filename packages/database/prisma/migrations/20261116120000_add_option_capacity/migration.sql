-- Lets an organizer cap how many participants can answer "yes" to each option
-- (a workshop with ten seats, an oral exam slot for two).
--
-- One value for the whole poll, applied to every option. Null means no cap,
-- so every existing poll is unchanged. Only "yes" takes a place: "if need be"
-- is a fallback, not a booking.
--
-- Forward-only like allow_tentative_votes: lowering the cap below the yes
-- votes an option already holds keeps them, it only stops new ones.
ALTER TABLE "polls" ADD COLUMN "option_capacity" INTEGER;
