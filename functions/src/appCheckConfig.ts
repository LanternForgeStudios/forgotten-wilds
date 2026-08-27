// The Functions emulator sets FUNCTIONS_EMULATOR=true on itself; App Check tokens require a real
// registered Firebase app (reCAPTCHA site key + debug-token registration), which local dev
// shouldn't need just to call a Cloud Function against the emulator. Every onCall function passes
// this instead of a hardcoded `true` so enforcement is real in production but off locally.
export const ENFORCE_APP_CHECK = process.env.FUNCTIONS_EMULATOR !== 'true';
