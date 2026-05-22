import { resolveFrontendTenantId } from './tenant-context';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const passwordRequirements = [
  "At least 12 characters",
  "One lowercase letter",
  "One uppercase letter",
  "One number"
];

export const validateEmail = (email) => emailPattern.test(email.trim());

export const validatePasswordPolicy = (password) =>
  password.length >= 12 &&
  password.length <= 128 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /[0-9]/.test(password);

export const buildLoginPayload = async ({ email, password }) => ({
  tenantId: await resolveFrontendTenantId(),
  email: email.trim().toLowerCase(),
  password,
  deviceName: "Web browser"
});

export const splitName = (name) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined
  };
};

export const buildRegisterPayload = async ({ name, email, password }) => {
  const names = splitName(name);

  return {
    tenantId: await resolveFrontendTenantId(),
    email: email.trim().toLowerCase(),
    password,
    ...(names.firstName ? { firstName: names.firstName } : {}),
    ...(names.lastName ? { lastName: names.lastName } : {})
  };
};
