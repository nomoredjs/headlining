/**
 * Infer gig type from event name and venue name.
 */

const FESTIVAL_KEYWORDS = [
  "tomorrowland", "coachella", "ultra", "edc", "dekmantel", "sonar", "sónar",
  "movement", "creamfields", "crssd", "ade", "awakenings", "time warp",
  "primavera", "glastonbury", "parklife", "loveland", "sziget", "exit",
  "junction 2", "junction2", "fabric presents", "warehouse project",
  "hideout", "defected", "elrow", "secret garden party", "bestival",
  "festival", "fest ", " fest", "outdoor", "summer", "winter festival",
  "circuit", "sundown", "sunrise", "afterlife open air", "heart ibiza",
  "privilege", "ushuaïa", "ushuaia", "amnesia", "pacha presents",
  "burning man", "lost & found", "panorama festival", "day zero",
  "boiler room festival", "tobacco dock",
];

const ARENA_KEYWORDS = [
  "madison square garden", "msg", "o2 arena", "ally pally",
  "alexandra palace", "wembley", "forum", "allstate arena",
  "crypto.com arena", "kia forum", "ball arena", "barclays center",
  "chase center", "united center", "american airlines",
];

export function inferGigType(
  eventName: string,
  venueName: string
): "festival" | "arena" | "club" {
  const combined = `${eventName} ${venueName}`.toLowerCase();

  for (const kw of FESTIVAL_KEYWORDS) {
    if (combined.includes(kw)) return "festival";
  }
  for (const kw of ARENA_KEYWORDS) {
    if (combined.includes(kw)) return "arena";
  }
  return "club";
}
