import nodemailer from "nodemailer";

export async function sendVerificationCode({ to, code, purpose }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;
  if (!host || !user || !pass || !from) {
    throw Object.assign(new Error("Email sender is not configured."), { code: "MAIL_CONFIG" });
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(new Error("Invalid email sender configuration."), { code: "MAIL_CONFIG" });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  const action = purpose === "SIGNUP" ? "verify your email and create your account" : "sign in to your account";
  await transporter.sendMail({
    from,
    to,
    subject: "Your School Attendance verification code",
    text: `Use ${code} to ${action}. This code expires in 10 minutes. Never share this code with anyone. If you did not request it, ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden"><tr><td style="background:#173b8a;padding:24px 30px;color:#ffffff"><div style="font-size:13px;font-weight:700;letter-spacing:1.5px">RURAL SCHOOL ATTENDANCE</div></td></tr><tr><td style="padding:34px 30px 20px"><h1 style="margin:0 0 14px;font-size:24px;line-height:1.3">Verify your email</h1><p style="margin:0;color:#475569;font-size:15px;line-height:1.7">Use this one-time code to ${action}:</p><div style="margin:26px 0;padding:20px 12px;border:1px solid #dbeafe;border-radius:14px;background:#eff6ff;text-align:center;color:#1d4ed8;font-size:36px;font-weight:700;letter-spacing:10px">${code}</div><p style="margin:0;color:#475569;font-size:14px;line-height:1.7">This code expires in <strong>10 minutes</strong>.</p><div style="margin-top:22px;padding:14px 16px;border-radius:10px;background:#fff7ed;color:#9a3412;font-size:13px;line-height:1.6"><strong>Security notice:</strong> We will never ask you to share this code. If you did not request it, you can safely ignore this email.</div></td></tr><tr><td style="padding:8px 30px 28px;color:#94a3b8;font-size:12px">School Attendance · Secure teacher access</td></tr></table></td></tr></table></body></html>`,
  });
}
