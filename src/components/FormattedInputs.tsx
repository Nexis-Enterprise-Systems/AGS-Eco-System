import type { InputHTMLAttributes } from "react";
import { addressLines, capitaliseWords, formatName, formatPhone, formatPostcode, upperPostcode, type Address } from "../lib/format";

// Drop-in text inputs that apply the house formatting (see lib/format.ts).
type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string | null | undefined;
  onChange: (value: string) => void;
};

export function NameInput({ value, onChange, onBlur, person = false, className = "input", ...rest }: Base & { person?: boolean }) {
  return (
    <input
      {...rest}
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange(capitaliseWords(e.target.value))}
      onBlur={(e) => {
        const tidy = formatName(e.target.value, person);
        if (tidy !== (value ?? "")) onChange(tidy);
        onBlur?.(e);
      }}
    />
  );
}

export function PhoneInput({ value, onChange, className = "input", ...rest }: Base) {
  return (
    <input
      inputMode="tel"
      autoComplete="tel"
      {...rest}
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange(formatPhone(e.target.value))}
    />
  );
}

export function PostcodeInput({ value, onChange, onBlur, className = "input", ...rest }: Base) {
  return (
    <input
      autoComplete="postal-code"
      maxLength={8}
      {...rest}
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange(upperPostcode(e.target.value))}
      onBlur={(e) => {
        const tidy = formatPostcode(e.target.value);
        if (tidy !== (value ?? "")) onChange(tidy);
        onBlur?.(e);
      }}
    />
  );
}

// The standard address entry: five fields in the same order everywhere.
export function AddressFields({
  value,
  onChange,
  required = false,
}: {
  value: Address;
  onChange: (next: Address) => void;
  required?: boolean;
}) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <div className="sm:col-span-6">
        <label className="label">Address line 1{required ? " *" : ""}</label>
        <NameInput value={value.line1} onChange={(v) => set({ line1: v })} autoComplete="address-line1" />
      </div>
      <div className="sm:col-span-6">
        <label className="label">Address line 2</label>
        <NameInput value={value.line2} onChange={(v) => set({ line2: v })} autoComplete="address-line2" />
      </div>
      <div className="sm:col-span-3">
        <label className="label">Town / City{required ? " *" : ""}</label>
        <NameInput value={value.town} onChange={(v) => set({ town: v })} autoComplete="address-level2" />
      </div>
      <div className="sm:col-span-3">
        <label className="label">Postcode{required ? " *" : ""}</label>
        <PostcodeInput value={value.postcode} onChange={(v) => set({ postcode: v })} />
      </div>
      <div className="sm:col-span-6">
        <label className="label">County</label>
        <NameInput value={value.county} onChange={(v) => set({ county: v })} autoComplete="address-level1" />
      </div>
    </div>
  );
}

// Shows a stored address, one line per part.
export function AddressText({ text }: { text: string | null | undefined }) {
  const lines = addressLines(text);
  if (lines.length === 0) return <span>—</span>;
  return (
    <div>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
