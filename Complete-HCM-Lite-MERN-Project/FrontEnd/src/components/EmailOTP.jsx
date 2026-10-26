
import { useState } from "react";
import api from "../services/api";

export default function EmailOTP({ email, onVerified }) {
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  async function sendOTP() {
    setBusy(true);
    setMessage("");

    try {
      const { data } = await api.post("/auth/send-otp", { email });
      setMessage(data.message);
      setSent(true);
      setResendIn(60);

      // Cooldown display is only UX. Backend enforces the limit.
      const started = Date.now();
      const interval = setInterval(() => {
        const remaining = Math.max(
          0,
          60 - Math.floor((Date.now() - started) / 1000)
        );
        setResendIn(remaining);
        if (remaining === 0) clearInterval(interval);
      }, 1000);
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Could not send OTP"
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyOTP(event) {
    event.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      setMessage("Enter the 6-digit OTP");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { data } = await api.post("/auth/verify-otp", {
        email,
        otp,
      });

      setMessage(data.message);
      if (data.emailVerified) onVerified?.();
    } catch (error) {
      setMessage(
        error.response?.data?.message || "OTP verification failed"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Verify your email</h2>
      <p>{email}</p>

      {!sent ? (
        <button type="button" disabled={busy} onClick={sendOTP}>
          {busy ? "Sending..." : "Send OTP"}
        </button>
      ) : (
        <>
          <form onSubmit={verifyOTP}>
            <label htmlFor="email-otp">6-digit OTP</label>
            <input
              id="email-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? "Verifying..." : "Verify OTP"}
            </button>
          </form>

          <button
            type="button"
            disabled={busy || resendIn > 0}
            onClick={sendOTP}
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
          </button>
        </>
      )}

      <p role="status" aria-live="polite">{message}</p>
    </section>
  );
}
