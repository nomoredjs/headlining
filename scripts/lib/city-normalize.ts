/**
 * Normalize city names to canonical display names.
 * Applied at display time — raw data in DB stays unchanged.
 */

const CITY_MAP: Record<string, string> = {
  // Ibiza variants
  "platja d'en bossa": "Ibiza",
  "sant josep de sa talaia": "Ibiza",
  eivissa: "Ibiza",
  "ibiza town": "Ibiza",
  "san antonio": "Ibiza",
  "sant antoní de portmany": "Ibiza",

  // New York
  brooklyn: "New York",
  manhattan: "New York",
  queens: "New York",
  "new york city": "New York",
  nyc: "New York",
  bronx: "New York",

  // Los Angeles
  hollywood: "Los Angeles",
  "west hollywood": "Los Angeles",
  "east los angeles": "Los Angeles",
  "los angeles, ca": "Los Angeles",

  // London
  shoreditch: "London",
  hackney: "London",
  brixton: "London",
  dalston: "London",
  peckham: "London",
  "east london": "London",
  "south london": "London",
  "north london": "London",
  "west london": "London",
  "london, uk": "London",

  // Berlin
  kreuzberg: "Berlin",
  friedrichshain: "Berlin",
  mitte: "Berlin",
  prenzlauer: "Berlin",
  "berlin, germany": "Berlin",

  // Miami
  wynwood: "Miami",
  "south beach": "Miami",
  "miami beach": "Miami",
  "miami, fl": "Miami",

  // Amsterdam
  "amsterdam, nl": "Amsterdam",
};

export function normalizeCity(city: string): string {
  const key = city.toLowerCase().trim();
  return CITY_MAP[key] ?? city;
}
