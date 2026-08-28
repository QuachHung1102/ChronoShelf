"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { sendLoginCode, verifyLoginCode } from "@/lib/api/auth";
import { FIELD, LABEL, PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";

/**
 * Đăng nhập không mật khẩu: nhập email → nhận mã 6 số → xong.
 * Không tách đăng ký với đăng nhập vì backend không phân biệt hai việc đó ở luồng OTP.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra, thử lại giúp mình.");
    } finally {
      setBusy(false);
    }
  }

  const send = () =>
    run(async () => {
      await sendLoginCode(email);
      setCodeSent(true);
      setNotice(`Đã gửi mã tới ${email}. Mã có 6 chữ số và hết hạn sau ít phút.`);
    });

  return (
    <div className="w-full max-w-md rounded-lg bg-neutral p-xl">
      <p className="font-body text-label-caps uppercase text-tertiary-deep">Cửa sổ lịch sử</p>
      <h1 className="mt-sm font-heading text-headline-md text-primary-dark">
        {codeSent ? "Nhập mã trong email" : "Đăng nhập để giữ tiến độ"}
      </h1>
      <p className="mt-sm font-body text-body-sm text-secondary">
        {codeSent
          ? "Chưa có tài khoản cũng không sao — nhập đúng mã là tài khoản được tạo luôn."
          : "Không cần mật khẩu. Bọn mình gửi một mã 6 số tới email của bạn."}
      </p>

      {!codeSent ? (
        <form
          className="mt-lg flex flex-col gap-md"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className={LABEL} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="ban@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD}
          />
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON} mt-sm`}>
            <Send aria-hidden className="h-4 w-4" />
            {busy ? "Đang gửi…" : "Gửi mã đăng nhập"}
          </button>
        </form>
      ) : (
        <form
          className="mt-lg flex flex-col gap-md"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await verifyLoginCode(email, otp);
              router.replace(next);
              router.refresh();
            });
          }}
        >
          <label className={LABEL} htmlFor="login-otp">
            Mã xác minh
          </label>
          <input
            id="login-otp"
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="123456"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            className={`${FIELD} tracking-[0.4em]`}
          />
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON} mt-sm`}>
            <MailCheck aria-hidden className="h-4 w-4" />
            {busy ? "Đang kiểm tra…" : "Xác nhận"}
          </button>

          <div className="flex items-center justify-between gap-md">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCodeSent(false);
                setOtp("");
                setError(null);
                setNotice(null);
              }}
              className={QUIET_BUTTON}
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Đổi email
            </button>
            <button type="button" disabled={busy} onClick={() => void send()} className={QUIET_BUTTON}>
              Gửi lại mã
            </button>
          </div>
        </form>
      )}

      <p aria-live="polite" className="mt-md font-body text-body-sm text-secondary">
        {notice}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-md rounded-md bg-destructive p-md font-body text-body-sm text-on-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
