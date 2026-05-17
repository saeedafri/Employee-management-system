export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function parseOTPInput(input) {
  const digits = input.replace(/\D/g, '').slice(0, 6);
  return digits.length === 6 ? digits : null;
}
