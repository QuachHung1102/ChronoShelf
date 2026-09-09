import { RailNav } from "@/components/RailNav";
import { isAdmin } from "@/lib/admin/gate";
import { readShelfList } from "@/lib/content/read";

/**
 * Rail dọc — điều hướng chính của cả sản phẩm, thay cho dải header ngang 72px.
 *
 * VÌ SAO DỌC. Hai lý do, cả hai đo được:
 *
 * 1. **Hình dạng thiết bị.** Dự án chỉ chạy PC, ngưỡng thấp nhất 1024×768 — rộng hơn cao.
 *    Một dải ngang lấy 72px của chiều CAO, thứ khan hiếm; rail lấy 232px của chiều RỘNG,
 *    thứ đang dư. Mọi màn trong sản phẩm này đều chật theo chiều dọc chứ không theo chiều ngang.
 * 2. **Số kệ là biến do admin quyết.** Header ngang phải gom toàn bộ kệ vào một dropdown vì
 *    ở 1024px với 3 kệ thì nhãn đã gãy dòng và kệ thứ tư là tràn. Rail dọc liệt kê thẳng, và
 *    khi admin tạo tới kệ thứ hai mươi thì vùng nav tự cuộn — bớt hẳn một cú bấm trên đường
 *    đi thường xuyên nhất.
 *
 * VÌ SAO Ở ROOT LAYOUT chứ không ở từng trang. Bản trước cho mỗi page tự dựng rail của nó,
 * và người dùng báo đúng hệ quả: mỗi lần chuyển trang, rail bị tháo ra dựng lại cùng cả cây
 * — logo, danh sách kệ và hai đồng hồ chỉ số cùng nháy một nhịp, rồi `RailStats` và
 * `AuthMenu` phải gọi lại `/api/me/state` và `/api/auth/me`. Đặt ở layout thì Next giữ
 * nguyên rail qua mọi lần điều hướng và chỉ thay phần `children`.
 *
 * `readShelfList()` KHÔNG được phép làm chết cả ứng dụng. Ở root layout không có error
 * boundary nào phía trên để bắt (`app/error.tsx` nằm BÊN TRONG layout này), nên một cú nấc
 * database sẽ thành màn trắng toàn site thay vì một trang lỗi. Nuốt lỗi ở đây là đúng: rail
 * vẫn dựng, chỉ thiếu danh sách kệ, và trang con tự báo lỗi theo cách của nó.
 */
export async function Rail() {
  const shelves = await readShelfList().catch(() => []);
  // KHÔNG phải hàng rào bảo mật, chỉ là chuyện hiển thị — ba lớp thật ghi ở lib/admin/gate.ts.
  const laAdmin = await isAdmin().catch(() => false);

  return <RailNav shelves={shelves} laAdmin={laAdmin} />;
}
