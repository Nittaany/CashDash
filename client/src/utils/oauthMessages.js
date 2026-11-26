const OAUTH_ERROR_MESSAGES = {
  invalid_state: "The sign-in request expired or could not be verified. Please try again.",
  provider_cancelled: "Provider sign-in was cancelled.",
  provider_email_unverified: "Sign-in requires a verified email address from the provider.",
  account_exists_sign_in: "An account with that email already exists. Sign in first, then link the provider from your profile.",
  identity_already_linked: "This provider account is already linked to another CashDash account.",
  link_session_expired: "Your session expired. Sign in and try linking the provider again.",
  provider_failed: "Provider sign-in could not be completed. Please try again."
};

export function getOAuthErrorMessage(code) {
  return OAUTH_ERROR_MESSAGES[code] || OAUTH_ERROR_MESSAGES.provider_failed;
}
