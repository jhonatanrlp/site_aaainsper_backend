// CPF format: 11 digits. Mask shows only the last 2 (e.g. ***.***.***-45),
// mirroring the legacy schema's cpf_mask generated column. Raw CPF is never
// returned by a generic read anywhere in the API — see modules/users.
export function maskCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  const lastTwo = digits.slice(-2).padStart(2, '*');
  return `***.***.***-${lastTwo}`;
}

const CPF_REGEX = /^\d{11}$/;

export function isValidCpfFormat(cpf: string): boolean {
  return CPF_REGEX.test(cpf.replace(/\D/g, ''));
}
