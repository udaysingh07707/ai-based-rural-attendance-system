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

## Self-hosted face recognition (consent-gated)

Face matching uses a separate local Python process running OpenCV YuNet and SFace. It is not an external AI service. The service binds to `127.0.0.1:8765` by default, writes no classroom images to disk, and requires `FACE_SERVICE_TOKEN`. Do not expose this service publicly.

1. Install the pinned Python dependencies:

   ```powershell
   python -m pip install -r face_service/requirements.txt
   ```

2. Download and verify the pinned OpenCV Zoo model files:

   ```powershell
   python face_service/download_models.py
   ```

   Model weights are excluded from Git. The downloader verifies SHA-256 before keeping them.

3. Create local secrets without sharing them. Generate a 32-byte encryption key with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Generate a separate shared service token with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Put `FACE_TEMPLATE_ENCRYPTION_KEYS` in the project root `.env` as a JSON map from key version to base64 key. Set `FACE_TEMPLATE_KEY_VERSION` to the active version; retain older keys in the keyring until all templates have been re-encrypted. Put the service token in the project root `.env` for Next.js. Copy `face_service/.env.example` to `face_service/.env` and put only the same service token there for Python. The inference process must not load the Next.js `.env`, because that file also contains unrelated application secrets. Keep both files private locally and use a secret manager in production. Never use `NEXT_PUBLIC_` variables for these values.

4. Start the inference service and Next.js in separate terminals:

   ```powershell
   python face_service/server.py
   npm run dev
   ```

Face enrollment requires a recorded guardian-consent attestation and a student profile photo with exactly one sufficiently large face. Existing profile photos are not consented or enrolled automatically. Revoking consent deletes the face template. Replacing/removing the profile photo invalidates its template.

`FACE_RECOGNITION_ENABLED` defaults to `false`. Do not enable matching or set `FACE_MATCH_THRESHOLD` and `FACE_MATCH_MARGIN` until the decision thresholds have been evaluated on consented, known-identity images representative of the school’s cameras and lighting. The UI scores are similarities, not probabilities. Non-detection is not proof of absence, and attendance always requires teacher review and confirmation.

The Python inference service must run on the same host or an isolated private network reachable by Next.js. Production must provide CPU capacity, model files, a secret manager, TLS/service authentication when crossing hosts, resource limits, and operational monitoring that never records photos, embeddings, or authorization tokens. Serverless deployments without a private Python runtime need a separate self-hosted service.
