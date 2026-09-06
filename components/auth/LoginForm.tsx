"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LogIn, UserPlus } from "lucide-react";
import { dangKy, dangNhap, khoiPhuc, layCauHoi } from "@/lib/api/auth";
import { CAU_HOI_BAO_MAT, timCauHoi } from "@/lib/auth/cau-hoi-bao-mat";
import { MAT_KHAU_TOI_THIEU } from "@/lib/auth/mat-khau";
import { FIELD, LABEL, PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";

/**
 * Đăng nhập bằng email + mật khẩu, khôi phục bằng câu hỏi bảo mật.
 *
 * Ba chế độ trên cùng một thẻ, không phải ba trang: người dùng nhầm giữa "đăng nhập" và
 * "đăng ký" là chuyện thường, và bắt họ điều hướng qua lại giữa các URL chỉ để sửa cái
 * nhầm đó là thêm việc cho không.
 *
 * Khôi phục có hai bước vì phải HỎI MÁY CHỦ câu hỏi bảo mật của email đó. Máy chủ luôn
 * trả về một câu hỏi, kể cả email chưa có tài khoản — nên bước này không nói cho ai biết
 * tài khoản có tồn tại hay không.
 */

type CheDo = "dang-nhap" | "dang-ky" | "khoi-phuc";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [cheDo, setCheDo] = useState<CheDo>("dang-nhap");
  const [email, setEmail] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [cauHoi, setCauHoi] = useState(CAU_HOI_BAO_MAT[0].ma);
  const [dapAn, setDapAn] = useState("");
  /** Mã câu hỏi máy chủ trả về ở bước 1 của khôi phục; null nghĩa là chưa hỏi. */
  const [cauHoiCuaToi, setCauHoiCuaToi] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chay(buoc: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await buoc();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra, thử lại giúp mình.");
    } finally {
      setBusy(false);
    }
  }

  const vaoTrong = () => {
    router.replace(next);
    router.refresh();
  };

  function doiCheDo(moi: CheDo) {
    setCheDo(moi);
    setError(null);
    setMatKhau("");
    setDapAn("");
    setCauHoiCuaToi(null);
  }

  const tieuDe = {
    "dang-nhap": "Đăng nhập để giữ tiến độ",
    "dang-ky": "Tạo tài khoản mới",
    "khoi-phuc": "Quên mật khẩu",
  }[cheDo];

  // Cảnh báo về câu hỏi bảo mật KHÔNG còn nằm ở đây. Nó từng bị nhét vào mô tả chế độ
  // đăng ký, tức xuất hiện ở đầu thẻ — trước lúc người dùng chạm tới ô câu hỏi — bằng
  // kiểu chữ mờ nhất trên thẻ (`body-sm`/`secondary`). Nay nó là một khối ghi chú đặt
  // ngay trên chính ô đó, xem `ghiChuCauHoi` bên dưới.
  const moTa = {
    "dang-nhap": "Nhập email và mật khẩu của bạn.",
    "dang-ky": `Mật khẩu tối thiểu ${MAT_KHAU_TOI_THIEU} ký tự.`,
    "khoi-phuc": cauHoiCuaToi
      ? "Trả lời câu hỏi bảo mật rồi đặt mật khẩu mới."
      : "Bọn mình không gửi email đặt lại mật khẩu. Nhập email để lấy câu hỏi bảo mật của bạn.",
  }[cheDo];

  /**
   * Ứng dụng KHÔNG gửi bất kỳ email nào (CLAUDE.md § Đăng nhập) — không có nhà cung cấp
   * mail và sẽ không gắn. Nhưng một ô "Email" dạy người dùng đúng điều ngược lại: mọi ứng
   * dụng khác đều gửi thư xác thực và có nút "gửi lại mật khẩu". Điều ngoại lệ đó phải
   * được nói đúng lúc người ta đang chọn câu hỏi, vì hậu quả của việc chọn bừa là mất tài
   * khoản vĩnh viễn. Dùng lại đúng kiểu khối ghi chú của bước khôi phục ở dưới.
   */
  const ghiChuCauHoi = (
    <p className="rounded-md bg-surface p-md font-body text-body-md text-primary-dark">
      Đây là cách <strong className="font-semibold">duy nhất</strong> lấy lại tài khoản nếu bạn quên mật khẩu — bọn
      mình không gửi email đặt lại. Hãy chọn câu bạn chắc chắn nhớ.
    </p>
  );

  const oEmail = (
    <>
      <label className={LABEL} htmlFor="auth-email">
        Email
      </label>
      <input
        id="auth-email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="ban@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        // Ở bước 2 của khôi phục thì email đã chốt: đổi nó mà giữ nguyên câu hỏi đang
        // hiện là hỏi một đằng trả lời một nẻo.
        readOnly={cheDo === "khoi-phuc" && cauHoiCuaToi !== null}
        className={FIELD}
      />
    </>
  );

  return (
    <div className="w-full max-w-md rounded-lg bg-neutral p-xl">
      <p className="font-body text-label-caps uppercase text-tertiary-deep">Cửa sổ lịch sử</p>
      <h1 className="mt-sm font-heading text-headline-md text-primary-dark">{tieuDe}</h1>
      <p className="mt-sm font-body text-body-sm text-secondary">{moTa}</p>

      {cheDo === "dang-nhap" && (
        <form
          className="mt-lg flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            void chay(async () => {
              await dangNhap(email, matKhau);
              vaoTrong();
            });
          }}
        >
          {oEmail}
          <label className={LABEL} htmlFor="auth-mat-khau">
            Mật khẩu
          </label>
          <input
            id="auth-mat-khau"
            type="password"
            required
            autoComplete="current-password"
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
            className={FIELD}
          />
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON} mt-sm`}>
            <LogIn aria-hidden className="h-4 w-4" />
            {busy ? "Đang kiểm tra…" : "Đăng nhập"}
          </button>

          {/* Nhãn phải nói nút LÀM GÌ: "Chưa có tài khoản?" là một câu hỏi, đọc xong vẫn
              chưa biết bấm vào thì chuyện gì xảy ra (mở trang khác? hiện thêm ô?). Cả hai
              nay cùng khuôn "câu hỏi rồi động từ" như nút ở hai chế độ kia, và cùng có
              icon — `KeyRound` chính là icon của nút gửi ở chế độ khôi phục, tức người
              dùng sẽ gặp lại nó ở bước sau. */}
          <div className="flex flex-wrap items-center justify-between gap-md">
            <button type="button" onClick={() => doiCheDo("dang-ky")} className={QUIET_BUTTON}>
              <UserPlus aria-hidden className="h-4 w-4" />
              Chưa có tài khoản? Tạo mới
            </button>
            <button type="button" onClick={() => doiCheDo("khoi-phuc")} className={QUIET_BUTTON}>
              <KeyRound aria-hidden className="h-4 w-4" />
              Quên mật khẩu? Khôi phục
            </button>
          </div>
        </form>
      )}

      {cheDo === "dang-ky" && (
        <form
          className="mt-lg flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            void chay(async () => {
              await dangKy(email, matKhau, cauHoi, dapAn);
              vaoTrong();
            });
          }}
        >
          {oEmail}
          <label className={LABEL} htmlFor="auth-mat-khau-moi">
            Mật khẩu
          </label>
          <input
            id="auth-mat-khau-moi"
            type="password"
            required
            minLength={MAT_KHAU_TOI_THIEU}
            autoComplete="new-password"
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
            className={FIELD}
          />

          {ghiChuCauHoi}

          <label className={LABEL} htmlFor="auth-cau-hoi">
            Câu hỏi bảo mật
          </label>
          <select
            id="auth-cau-hoi"
            value={cauHoi}
            onChange={(e) => setCauHoi(e.target.value)}
            className={FIELD}
          >
            {CAU_HOI_BAO_MAT.map((c) => (
              <option key={c.ma} value={c.ma}>
                {c.hoi}
              </option>
            ))}
          </select>

          <label className={LABEL} htmlFor="auth-dap-an">
            Đáp án
          </label>
          <input
            id="auth-dap-an"
            type="text"
            required
            autoComplete="off"
            value={dapAn}
            onChange={(e) => setDapAn(e.target.value)}
            className={FIELD}
          />
          <p className="font-body text-caption text-secondary">
            Không phân biệt hoa thường và dấu tiếng Việt — “Hà Nội” và “ha noi” đều được.
          </p>

          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON} mt-sm`}>
            <UserPlus aria-hidden className="h-4 w-4" />
            {busy ? "Đang tạo…" : "Tạo tài khoản"}
          </button>

          <button type="button" onClick={() => doiCheDo("dang-nhap")} className={QUIET_BUTTON}>
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Đã có tài khoản? Đăng nhập
          </button>
        </form>
      )}

      {cheDo === "khoi-phuc" && (
        <form
          className="mt-lg flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            void chay(async () => {
              if (cauHoiCuaToi === null) {
                setCauHoiCuaToi(await layCauHoi(email));
                return;
              }
              await khoiPhuc(email, dapAn, matKhau);
              vaoTrong();
            });
          }}
        >
          {oEmail}

          {cauHoiCuaToi !== null && (
            <>
              <p className="rounded-md bg-surface p-md font-body text-body-md text-primary-dark">
                {timCauHoi(cauHoiCuaToi)?.hoi ?? "Câu hỏi bảo mật của bạn"}
              </p>

              <label className={LABEL} htmlFor="auth-dap-an-kp">
                Đáp án
              </label>
              <input
                id="auth-dap-an-kp"
                type="text"
                required
                autoComplete="off"
                autoFocus
                value={dapAn}
                onChange={(e) => setDapAn(e.target.value)}
                className={FIELD}
              />

              <label className={LABEL} htmlFor="auth-mat-khau-dat-lai">
                Mật khẩu mới
              </label>
              <input
                id="auth-mat-khau-dat-lai"
                type="password"
                required
                minLength={MAT_KHAU_TOI_THIEU}
                autoComplete="new-password"
                value={matKhau}
                onChange={(e) => setMatKhau(e.target.value)}
                className={FIELD}
              />
            </>
          )}

          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON} mt-sm`}>
            <KeyRound aria-hidden className="h-4 w-4" />
            {busy
              ? "Đang xử lý…"
              : cauHoiCuaToi === null
                ? "Xem câu hỏi bảo mật"
                : "Đặt mật khẩu mới"}
          </button>

          <button type="button" onClick={() => doiCheDo("dang-nhap")} className={QUIET_BUTTON}>
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Quay lại đăng nhập
          </button>
        </form>
      )}

      {/* Vùng lỗi có mặt SẴN, rỗng nhưng vẫn hiện: `display:none` lúc rỗng sẽ gỡ nó khỏi
          cây trợ năng, và khi lỗi xuất hiện thì trình đọc màn hình coi đó là một vùng
          vừa được THÊM chứ không phải một thay đổi — thường là im lặng. */}
      <p
        role="alert"
        className={
          error
            ? "mt-md rounded-md bg-destructive p-md font-body text-body-sm text-on-destructive"
            : "mt-md font-body text-body-sm"
        }
      >
        {error}
      </p>
    </div>
  );
}
