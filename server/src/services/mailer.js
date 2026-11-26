/**
 * Mailer service adapter
 * - In production with RESEND_API_KEY: sends real emails via Resend HTTPS API
 * - In dev/test without RESEND_API_KEY: uses mock transport (no external deps)
 */

// Lazy-load env to avoid circular dependency during test setup
let _env = null;
function getEnv() {
  if (!_env) {
    _env = import("../config/env.js").then((m) => m.env);
  }
  return _env;
}

// Mock transport for tests and dev without RESEND_API_KEY
const mockTransport = {
  sentEmails: [],
  async send(to, subject, html) {
    const email = { to, subject, html, sentAt: new Date() };
    this.sentEmails.push(email);
    return email;
  },
  clear() {
    this.sentEmails = [];
  }
};

// Export for test mocking
export { mockTransport };

/**
 * Send email via Resend API or mock transport
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 * @returns {Promise<{ id?: string, mock?: boolean }>}
 */
async function sendEmail(to, subject, html) {
  const env = await getEnv();
  const resendKey = env.RESEND_API_KEY;
  const mailFrom = env.MAIL_FROM;

  if (env.NODE_ENV === "test") {
    await mockTransport.send(to, subject, html);
    return { mock: true };
  }

  if (!resendKey) {
    if (env.NODE_ENV === "production") {
      throw new Error("Email delivery is not configured");
    }

    await mockTransport.send(to, subject, html);
    return { mock: true };
  }

  // Send via Resend HTTPS API (Node 22 built-in fetch)
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: mailFrom,
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    // Log status only, never the response body which might contain sensitive info
    console.error(`[MAILER] Resend error: ${response.status}`);
    throw new Error(`Email send failed: ${response.status}`);
  }

  const data = await response.json();
  return { id: data.id };
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Raw reset token (not hashed)
 * @returns {Promise<boolean>}
 */
export async function sendPasswordResetEmail(email, token) {
  const env = await getEnv();
  const resetUrl = `${env.primaryClientUrl}/reset-password?token=${encodeURIComponent(token)}`;
  
  const subject = "CashDash - Password Reset Request";
  const html = `
    <h2>Password Reset Request</h2>
    <p>You requested a password reset for your CashDash account.</p>
    <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;

  await sendEmail(email, subject, html);
  return true;
}

/**
 * Send email verification email
 * @param {string} email - Recipient email
 * @param {string} token - Raw verification token (not hashed)
 * @returns {Promise<boolean>}
 */
export async function sendVerificationEmail(email, token) {
  const env = await getEnv();
  const verifyUrl = `${env.primaryClientUrl}/verify-email?token=${encodeURIComponent(token)}`;
  
  const subject = "CashDash - Verify Your Email";
  const html = `
    <h2>Welcome to CashDash!</h2>
    <p>Please verify your email address to complete your registration.</p>
    <p>Click the link below to verify. This link expires in 24 hours.</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>If you did not create an account, you can safely ignore this email.</p>
  `;

  await sendEmail(email, subject, html);
  return true;
}
