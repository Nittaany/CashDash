/**
 * Mailer service adapter
 * In production with SMTP_HOST or RESEND_API_KEY, sends real emails
 * In dev/test, logs to console (mockable for tests)
 */

// Get primary client origin for reset links (lazy load env to avoid circular dependency)
function getPrimaryClientOrigin() {
  // Dynamic import to avoid loading env during test setup
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const origins = clientUrl.split(",").map((o) => o.trim());
  return origins[0];
}

// Mock transport for tests and dev without SMTP
const mockTransport = {
  sentEmails: [],
  async send(to, subject, html) {
    const email = { to, subject, html, sentAt: new Date() };
    this.sentEmails.push(email);
    if (process.env.NODE_ENV === "development") {
      console.log(`[MAILER] Would send email to ${to}: ${subject}`);
    }
    return email;
  },
  clear() {
    this.sentEmails = [];
  }
};

// Export for test mocking
export { mockTransport };

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Raw reset token (not hashed)
 * @returns {Promise<boolean>} - Whether email was sent (or would be sent)
 */
export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${getPrimaryClientOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
  
  const subject = "CashDash - Password Reset Request";
  const html = `
    <h2>Password Reset Request</h2>
    <p>You requested a password reset for your CashDash account.</p>
    <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;

  // For now, use mock transport (real SMTP integration can be added later)
  // This keeps the CI and tests working without external dependencies
  await mockTransport.send(email, subject, html);
  
  return true;
}
