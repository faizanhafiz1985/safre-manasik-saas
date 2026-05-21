// Validation patterns for form fields
export const PATTERNS = {
  ALPHA_ONLY: /^[a-zA-Z؀-ۿ\s\-'.]+$/,
  NUMERIC_ONLY: /^[0-9]+$/,
  DECIMAL: /^[0-9]+(\.[0-9]+)?$/,
  PHONE: /^[+0-9\s\-]{7,20}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9؀-ۿ\s\-_.]+$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PLATE: /^[a-zA-Z0-9؀-ۿ\s\-]+$/,
  PASSPORT: /^[a-zA-Z0-9]+$/,
  CURRENCY_CODE: /^[A-Z]{3}$/,
};

export const MESSAGES = {
  ALPHA_ONLY: 'Letters only',
  NUMERIC_ONLY: 'Numbers only',
  DECIMAL: 'Valid number required',
  PHONE: 'Valid phone number required',
  ALPHANUMERIC: 'Letters and numbers only',
  EMAIL: 'Valid email required',
  PLATE: 'Valid plate number required',
  PASSPORT: 'Letters and numbers only (no spaces)',
  CURRENCY_CODE: '3 uppercase letters (e.g. SAR)',
};

// Prevent non-numeric keystrokes on number-only fields
export const numericOnly = (e) => {
  if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
  }
};

// Prevent non-numeric (allow decimal point)
export const decimalOnly = (e) => {
  if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
  }
};

// Prevent digits on alpha-only fields
export const alphaOnly = (e) => {
  if (/[0-9]/.test(e.key)) e.preventDefault();
};

// Prevent spaces on fields that shouldn't have them (e.g. passport)
export const noSpace = (e) => {
  if (e.key === ' ') e.preventDefault();
};
