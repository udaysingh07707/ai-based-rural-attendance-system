# Backend setup

The app uses Next.js App Router, Prisma, and PostgreSQL for schools, teachers, students, classes, and attendance. Authentication uses email/password with email verification codes sent through Gmail SMTP. Google OAuth has been removed.

## Configure Gmail SMTP

Enable 2-Step Verification on the Gmail sender account and create a Google App Password. Set the app password as `SMTP_PASS`; a normal Gmail password will not work. See [Google's App Password instructions](https://support.google.com/accounts/answer/185833).

Set these variables in `.env`:

```env
DATABASE_URL="your PostgreSQL connection string"
SESSION_SECRET="a random secret with at least 32 bytes"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-sender@gmail.com"
SMTP_PASS="your-16-character-app-password"
EMAIL_FROM="School Attendance <your-sender@gmail.com>"
```

Keep `.env` private and never prefix secrets with `NEXT_PUBLIC_`. The sender account receives no user password; the signup email address receives the verification code.

## Run locally

```powershell
npm install
npm run db:generate
npm run db:deploy
npm run dev
```

Open `/login`, create an account, and enter the six-digit code sent to that email. The signup OTP is stored as a hash, expires after 10 minutes, allows at most five incorrect attempts, and can be resent after a 60-second cooldown. The account is created only after successful verification. Sign in with the verified email and password. Passwords are bcrypt hashed.

## Production

Apply migrations with `npm run db:deploy`. Set `DATABASE_URL`, `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in the hosting provider's encrypted environment settings. Use an SMTP provider that allows outbound mail on the selected port, and ensure `EMAIL_FROM` is authorized for the sender account. Do not commit `.env` or expose secrets to browser code.

The session cookie is HTTP-only and secure in production. Dashboard and attendance APIs require a valid session belonging to an email-verified teacher.

## Relevant API routes

- `POST /api/auth/otp/send` validates signup details, stores a temporary OTP challenge and sends the code; `resend: true` enforces the resend cooldown.
- `POST /api/auth/otp/verify` verifies the signup code, creates the school and verified teacher, and starts a session.
- `POST /api/auth/login` checks email/password and refuses unverified accounts.
- `GET /api/auth/session` checks the session; `POST /api/auth/logout` ends it.

The photo attendance page remains teacher-reviewed; it does not perform face recognition.
