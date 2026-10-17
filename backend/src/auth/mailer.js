import { Resend } from 'resend'
import { config } from '../config.js'
import { signVerifyToken } from './tokens.js'

const resend = config.auth.resendApiKey ? new Resend(config.auth.resendApiKey) : null

if (!resend) {
  console.warn('[auth] RESEND_API_KEY is not set; verification links will be printed to this console instead of emailed.')
}

export const verificationLink = (userId) =>
  `${config.auth.apiPublicUrl}/api/v1/auth/verify?token=${encodeURIComponent(signVerifyToken(userId))}`

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Send (or, without Resend, log) the verification link. Never throws: email
 * trouble must not fail registration. Returns how it was delivered.
 * @returns {Promise<'email' | 'console'>}
 */
export async function sendVerificationEmail(user) {
  const link = verificationLink(user.id)

  if (!resend) {
    console.info(`[auth] Verification link for ${user.email}:\n  ${link}`)
    return 'console'
  }

  try {
    const { error } = await resend.emails.send({
      from: config.auth.emailFrom,
      to: user.email,
      subject: 'Verify your AeroSpec account',
      text: `Hi ${user.name},\n\nConfirm your email to activate your AeroSpec account:\n${link}\n\nThis link expires in 24 hours.`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;background:#020617;color:#e2e8f0;border-radius:16px">
          <h1 style="font-size:20px;margin:0 0 12px">Welcome aboard, ${escapeHtml(user.name)}</h1>
          <p style="color:#94a3b8">Confirm your email to activate full access to your AeroSpec telemetry dashboard.</p>
          <p style="margin:24px 0">
            <a href="${link}" style="background:#06b6d4;color:#020617;padding:12px 20px;border-radius:12px;font-weight:600;text-decoration:none">Verify email</a>
          </p>
          <p style="color:#64748b;font-size:12px">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
        </div>`,
    })
    if (error) throw new Error(error.message ?? String(error))
    return 'email'
  } catch (err) {
    console.warn(`[auth] Resend failed for ${user.email} (${err.message}). Verification link:\n  ${link}`)
    return 'console'
  }
}
