// House formatting rules for text the system collects. One place, so every
// form, the onboarding page and CSV imports all behave the same.
//
//  Names:     every word starts with a capital letter.
//  Phones:    UK numbers as 5 digits, a space, 6 digits (01234 567890).
//             0207 and 0208 numbers as 4 digits, a space, 7 digits (0208 1234567).
//  Postcodes: upper case, outward code, a space, inward code (CM13 2RU).

// Capitalises the first letter of each word (after a space, hyphen or
// apostrophe) and leaves everything else as typed. Safe to run on every
// keystroke because it never changes the length or removes a space.
export function capitaliseWords(v: string): string {
  return v.replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

// Full tidy-up, run when the person leaves the field. For people's names,
// a name typed entirely in capitals or entirely in lower case is converted
// to normal case ("JOHN SMITH" becomes "John Smith"); mixed case such as
// "McDonald" is left alone. For company names only the first letters are
// capitalised, so "HSBC" and "BT" stay as typed.
export function formatName(v: string, person = false): string {
  let s = v.replace(/\s+/g, " ").trim();
  if (person && s && (s === s.toUpperCase() || s === s.toLowerCase())) s = s.toLowerCase();
  return capitaliseWords(s);
}

export function formatPhone(v: string): string {
  const raw = v.trim();
  // Other countries: leave as typed, digits, spaces and the plus sign only.
  if (raw.startsWith("+") && !/^\+\s*44/.test(raw)) return raw.replace(/[^\d+ ]/g, "");
  let d = raw.replace(/\D/g, "");
  if (/^\s*\+/.test(raw) || d.startsWith("0044")) {
    d = d.replace(/^(00)?44/, "");
    d = d.replace(/^0/, "");
    d = "0" + d;
  }
  d = d.slice(0, 11);
  const split = /^020[78]/.test(d) ? 4 : 5;
  return d.length > split ? `${d.slice(0, split)} ${d.slice(split)}` : d;
}

export function isValidPhone(v: string): boolean {
  const s = v.trim();
  if (/^\+\d[\d ]{7,}$/.test(s) && !/^\+44/.test(s)) return true;
  const d = s.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("0");
}

// While typing: upper case only. Spacing is fixed when the field is left.
export function upperPostcode(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").slice(0, 8);
}

export function formatPostcode(v: string): string {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length >= 5 && s.length <= 7 ? `${s.slice(0, -3)} ${s.slice(-3)}` : s;
}

export function isValidPostcode(v: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/.test(formatPostcode(v));
}

// Used by CSV import: tidy a value according to the kind of field it is.
export function autoFormat(fieldKey: string, value: string): string {
  if (!value) return value;
  if (/phone|mobile/i.test(fieldKey)) return formatPhone(value);
  if (/post_?code/i.test(fieldKey)) return formatPostcode(value);
  if (/(^|_)address$/i.test(fieldKey))
    return capitaliseWords(value.replace(/\s+/g, " ").trim()).replace(
      /\b([A-Za-z]{1,2}\d[A-Za-z\d]?)\s?(\d[A-Za-z]{2})\b/g,
      (_m, out: string, inn: string) => `${out} ${inn}`.toUpperCase()
    );
  if (/(^|_)(full_)?name$/i.test(fieldKey)) return formatName(value, /full_name|contact_name/i.test(fieldKey));
  return value;
}

// ---- Addresses ---------------------------------------------------------
// One layout everywhere, in this order:
//   Address line 1 / Address line 2 / Town or city / Postcode / County
// Stored as five lines of text (empty lines kept) so a single address
// column can hold it, and read back with parseAddress.
export interface Address {
  line1: string;
  line2: string;
  town: string;
  postcode: string;
  county: string;
}

export const emptyAddress = (): Address => ({ line1: "", line2: "", town: "", postcode: "", county: "" });

export function serialiseAddress(a: Address): string {
  const parts = [a.line1, a.line2, a.town, a.postcode, a.county].map((x) => (x ?? "").trim());
  return parts.every((x) => !x) ? "" : parts.join("\n");
}

export function parseAddress(text: string | null | undefined): Address {
  if (!text) return emptyAddress();
  const lines = text.split("\n");
  if (lines.length === 5) return { line1: lines[0], line2: lines[1], town: lines[2], postcode: lines[3], county: lines[4] };
  // Older free-text address: keep it all on line 1 so it can be tidied by hand.
  return { ...emptyAddress(), line1: text.replace(/\s*\n\s*/g, ", ").trim() };
}

// The lines to show, in order, skipping any that are empty.
export function addressLines(text: string | null | undefined): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  return lines.map((l) => l.trim()).filter(Boolean);
}

export function addressOneLine(text: string | null | undefined): string {
  return addressLines(text).join(", ");
}

// Returns a message if the address is not complete enough, otherwise null.
export function addressProblem(a: Address): string | null {
  if (!a.line1.trim()) return "Please enter the first line of your address.";
  if (!a.town.trim()) return "Please enter your town or city.";
  if (!a.postcode.trim() || !isValidPostcode(a.postcode)) return "Please enter a valid postcode, for example CM13 2RU.";
  return null;
}
