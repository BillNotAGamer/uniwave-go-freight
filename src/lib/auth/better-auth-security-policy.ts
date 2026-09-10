import betterAuthSecurityPolicyJson from "./better-auth-security-policy.json";

export type BetterAuthSecurityPolicy = typeof betterAuthSecurityPolicyJson;

export const betterAuthSecurityPolicy = betterAuthSecurityPolicyJson;

export function isPasswordlessEmailAuthEnabled(
  policy: BetterAuthSecurityPolicy = betterAuthSecurityPolicy,
): boolean {
  return (
    policy.passwordlessEmail.magicLinkEnabled ||
    policy.passwordlessEmail.emailOtpEnabled ||
    policy.passwordlessEmail.passwordlessEmailSignInEnabled
  );
}

export function isBetterAuthAdvisoryWaiverValid(
  policy: BetterAuthSecurityPolicy = betterAuthSecurityPolicy,
): boolean {
  return !isPasswordlessEmailAuthEnabled(policy);
}
