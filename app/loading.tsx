import { SKELETON_BLOCK, SKELETON_HEADER } from "@/components/ui/controls";

/**
 * Khung xương dùng chung cho MỌI trang nền sáng: `/`, `/cong-dong`, `/bai-giang`,
 * `/tui-hanh-trang`, `/dang-nhap` và cả khu `/quan-tri`.
 *
 * Trước đây cả ứng dụng không có một `loading.tsx` nào, mà mọi trang đều `force-dynamic`
 * và đọc database phía server — nên bấm một liên kết là màn hình đứng im nguyên trang cũ
 * suốt cả vòng gọi máy chủ. Không có ranh giới Suspense thì App Router không hiện được gì
 * cả, kể cả khung xương.
 *
 * MỘT file ở gốc `app/` thay vì năm file cho năm route: `loading.tsx` bọc `page.tsx` và
 * mọi `layout.tsx` nằm dưới nó trong một `<Suspense>`, nên file này che hết. Chỉ
 * `app/[shelf]/loading.tsx` có bản riêng, vì màn kệ sách là nền TỐI — dùng chung khung
 * xương sáng ở đó sẽ nháy trắng một nhịp rồi mới tối lại.
 *
 * Khung xương phải tự vẽ lại dải header: repo chỉ có một layout (`app/layout.tsx`) và nó
 * KHÔNG dựng `Header` — mỗi trang tự dựng — nên fallback thay luôn cả dải nâu. Không gọi
 * `<Header>` thật ở đây được: nó `await` database, mà một fallback thì không được phép
 * treo.
 *
 * CỐ Ý đứng yên, không nhấp nháy: DESIGN.md § Motion đòi trạng thái cuối ở hai chế độ
 * `prefers-reduced-motion` phải giống hệt nhau, và một dòng chữ "Đang tải…" đã nói đủ
 * điều mà một hoạt cảnh xương nhấp nháy định nói.
 */
export default function DangTai() {
  return (
    <>
      {/* Tên sản phẩm là CHỮ THẬT, không phải một vệt xương: nó là thứ to nhất trên dải
          nâu, nên giữ nguyên nó làm cú thay khung xương đọc ra là "các mục đang tải" chứ
          không phải "header vừa biến mất". Không bọc `<Link>`: lúc này chưa có gì để bấm. */}
      <div className={SKELETON_HEADER}>
        <span className="font-heading text-headline-sm text-on-primary">CỬA SỔ LỊCH SỬ</span>
      </div>

      <main id="noi-dung" className="flex-1 px-page-margin py-xl">
        <div className="mx-auto max-w-5xl">
          {/* Chữ thật, không phải một vệt xương nữa: đây là thứ duy nhất trên màn hình
              trả lời được câu "máy có nhận cú bấm của tôi không". Đặt đúng chỗ của dòng
              nhãn (`label-caps` + `tertiary-deep`) mà cả năm trang nền sáng đều mở đầu. */}
          <p role="status" className="font-body text-label-caps uppercase text-tertiary-deep">
            Đang tải…
          </p>

          <div aria-hidden className="mt-sm flex flex-col gap-md">
            <div className="h-xl w-2/3 max-w-measure rounded-sm bg-secondary-light" />
            <div className="h-md w-full max-w-measure rounded-sm bg-secondary-light" />
            <div className="h-md w-1/2 max-w-measure rounded-sm bg-secondary-light" />
          </div>

          <div aria-hidden className="mt-xl grid grid-cols-3 gap-lg">
            <div className={`${SKELETON_BLOCK} h-3xl`} />
            <div className={`${SKELETON_BLOCK} h-3xl`} />
            <div className={`${SKELETON_BLOCK} h-3xl`} />
          </div>
        </div>
      </main>
    </>
  );
}
