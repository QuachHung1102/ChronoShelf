import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { InkBasin } from "@/components/ink/InkBasin";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Đăng nhập — Cửa Sổ Lịch Sử",
};

/**
 * Cửa vào thế giới: bờ trái mang form, chậu mực tràn hết phần còn lại.
 *
 * Cùng ngữ pháp với màn kệ (`ShelfBasin`): chậu phủ TOÀN BỘ vùng nội dung và bờ — một
 * tấm giấy đặc — nằm đè lên nó, mép bờ tan vào nước bằng một dải gradient đứng NGOÀI bờ.
 * Bản trước chia ba cột rời (rail | thẻ form trôi giữa khoảng trắng | chậu bị một đường kẻ
 * cắt thẳng), và trên màn thật nó đọc ra là một mẫu dựng sẵn có dán thêm hình nền.
 *
 * Chữ không bao giờ đi trên mặt nước: mọi giọt nằm ở x ≥ 0.6, còn bờ rộng
 * `max(26rem, 45%)` — tức 0.45 bề ngang ở 1440px và 0.53 ở 1024px. Không giọt nào chui
 * xuống dưới tấm giấy ở cả hai đầu.
 *
 * Chậu ở đây KHÔNG `interactive`: đây là màn nhập mật khẩu, con trỏ đang làm việc khác.
 */
export default async function DangNhapPage({ searchParams }: PageProps<"/dang-nhap">) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <main id="noi-dung" className="relative flex min-w-0 flex-1 overflow-hidden bg-paper">
      <InkBasin
        pigment="cham"
        // Một giọt khoảng mỗi 2,6 giây, vị trí và thời điểm đều ngẫu nhiên. Không có nhịp
        // này thì mực tan hết và chậu về trắng trơn sau khoảng nửa phút.
        nhipGiot={2.6}
        // Ba giọt đặt sẵn, tất định: chậu phải CÓ vân ngay khung hình đầu tiên, nếu không
        // thì với người không rê chuột nó chỉ là một mảng trắng. Toạ độ gốc dưới-trái.
        seeds={[
          { x: 0.7, y: 0.68, dx: 0, dy: 0, amount: 0.5 },
          { x: 0.84, y: 0.44, dx: 0, dy: 0, amount: 0.4 },
          { x: 0.68, y: 0.28, dx: 0, dy: 0, amount: 0.28 },
        ]}
      />

      <div className="relative z-10 flex w-[max(26rem,45%)] shrink-0 items-center bg-paper px-page-margin py-xl after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-36 after:bg-gradient-to-r after:from-paper after:to-transparent after:content-['']">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
