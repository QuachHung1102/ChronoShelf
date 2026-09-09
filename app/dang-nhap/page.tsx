import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { InkBasin } from "@/components/ink/InkBasin";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Đăng nhập — Cửa Sổ Lịch Sử",
};

/**
 * Cửa vào thế giới: bờ trái mang form, chậu mực ở bên phải.
 *
 * Trước 2026-09-10 trang này bọc form trong `<Room>` — căn phòng gỗ với tường sách mờ và
 * hạt bụi trôi, tức thế giới cũ còn nguyên ở màn hình ĐẦU TIÊN người dùng gặp. Bố cục mới
 * dùng lại đúng ngữ pháp của màn kệ sách (`ShelfBasin`): chữ đứng ở lề tĩnh, mặt nước ở
 * bên kia bờ, không bao giờ chạy dưới chữ — luật nền tảng của DESIGN.md § Overview.
 *
 * Chậu ở đây KHÔNG `interactive`: đây là màn nhập mật khẩu, con trỏ đang làm việc khác.
 */
export default async function DangNhapPage({ searchParams }: PageProps<"/dang-nhap">) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <main id="noi-dung" className="flex min-w-0 flex-1 bg-paper">
      {/* Bờ: `max-w` chứ không phải tỉ lệ phần trăm — form rộng 448px cố định, nên bờ chỉ
          cần đủ chứa nó cộng lề, và phần dư đều thuộc về chậu. */}
      <div className="flex w-full max-w-[30rem] shrink-0 items-center justify-center px-page-margin py-xl">
        <LoginForm next={next} />
      </div>

      {/* Chậu chiếm phần còn lại. `overflow-hidden` vì canvas giãn theo khung; thiếu nó thì
          một khung nhìn hẹp làm nó nong trang ra và sinh cuộn ngang. */}
      <div className="relative flex-1 overflow-hidden border-l border-mist">
        <InkBasin
          pigment="cham"
          // Một giọt rơi khoảng mỗi 2,6 giây, vị trí và thời điểm đều ngẫu nhiên. Không có
          // nhịp này thì mực tan hết và chậu về trắng trơn sau khoảng nửa phút.
          nhipGiot={2.6}
          // Ba giọt đặt sẵn, tất định: chậu phải CÓ vân ngay khung hình đầu tiên, nếu không
          // thì với người không rê chuột nó chỉ là một mảng trắng. Toạ độ gốc dưới-trái.
          //
          // Ba giọt rơi theo trục **Oz** — vuông góc với màn hình. Chậu nhìn từ trên xuống,
          // nên giọt chạm mặt nước tại chỗ của nó rồi loang TRÒN ra; `giotRoi` lo phần đó.
          // Không giọt nào mang vector đẩy, vì bất kỳ vector nào cũng làm mực bay lệch một
          // phía — thứ người dùng đọc ra là 'con mực bắn mực'.
          //
          // Lượng mực nhẹ vì chậu ở đây chỉ rộng ~310px ở 1024, bằng một phần ba chậu của
          // màn kệ sách; cùng lượng mực ở đây là phủ kín mặt nước, mà mặt nước phủ kín thì
          // không còn là mặt nước.
          seeds={[
            { x: 0.38, y: 0.68, dx: 0, dy: 0, amount: 0.5 },
            { x: 0.6, y: 0.44, dx: 0, dy: 0, amount: 0.4 },
            { x: 0.44, y: 0.28, dx: 0, dy: 0, amount: 0.28 },
          ]}
        />
      </div>
    </main>
  );
}
