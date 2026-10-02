/**
 * MAX only accepts RF (11 digits, leading 7) and RB (12 digits, leading 375)
 * numbers, so validation happens client-side to avoid burning the rate-limited
 * CheckAccount call on numbers the API will reject anyway.
 */
const MAX_PHONE_PATTERN = /^(7\d{10}|375\d{9})$/;

export const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  // A locally dialled Russian number starts with 8; MAX expects 7.
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  return digits;
};

export const isValidMaxPhone = (digits: string): boolean =>
  MAX_PHONE_PATTERN.test(digits);

/** Best-effort display form; falls back to the raw digits when unrecognised. */
export const formatPhone = (digits: string): string => {
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("375")) {
    return `+375 (${digits.slice(3, 6)}) ${digits.slice(6, 9)}-${digits.slice(9, 11)}-${digits.slice(11)}`;
  }
  return digits;
};

export const PHONE_HINT =
  "11 цифр с кодом 7 (РФ) или 12 цифр с кодом 375 (РБ)";