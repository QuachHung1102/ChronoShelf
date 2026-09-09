import { SKELETON_BLOCK } from "@/components/ui/controls";

/**
 * Khung xương dùng chung cho MỌI trang nền sáng: `/`, `/cong-dong`, `/bai-giang`,
 * `/tui-hanh-trang` và cả khu `/quan-tri`.
 *
 * Trước đây cả ứng dụng không có một `loading.tsx` nào, mà mọi trang đều `force-dynamic` và
 * đọc database phía server — nên bấm một liên kết là màn hình đứng im nguyên trang cũ suốt
 * cả vòng gọi máy chủ. Không có ranh giới Suspense thì App Router không hiện được gì cả.
 *
 * MỘT file ở gốc `app/` thay vì năm file cho năm route: `loading.tsx` bọc `page.tsx` và mọi
 * `layout.tsx` nằm dưới nó trong một `<Suspense>`, nên file này che hết. Hai route có bản
 * riêng vì hình dạng của chúng khác hẳn — `app/[shelf]/loading.tsx` (khung không cuộn, có
 * chậu mực) và `app/dang-nhap/loading.tsx` (nền chàm).
 *
 * **KHÔNG vẽ rail ở đây.** Rail sống ở `app/layout.tsx`, tức nó nằm NGOÀI ranh giới Suspense
 * này và không hề bị thay khi chuyển trang. Bản trước vẽ thêm một rail xương cạnh rail thật
 * — hai rail dính nhau — và chính chuyện mỗi trang tự dựng rail của mình là nguồn của cú
 * giật khi chuyển trang mà người dùng đã báo.
 *
 * CỐ Ý đứng yên, không nhấp nháy: DESIGN.md § Motion đòi trạng thái cuối ở hai chế độ
 * `prefers-reduced-motion` phải giống hệt nhau, và một dòng chữ "Đang tải…" đã nói đủ điều
 * mà một hoạt cảnh xương nhấp nháy định nói.
 */
export default function DangTai() {
  return (
    <main id="noi-dung" className="min-w-0 flex-1 px-page-margin py-xl">
      <div className="mx-auto max-w-5xl">
        {/* Chữ thật, không phải một vệt xương: đây là thứ duy nhất trên màn hình trả lời
            được câu "máy có nhận cú bấm của tôi không". */}
        <p role="status" className="font-ui text-label-caps uppercase text-ink-dilute">
          Đang tải…
        </p>

        {/* MỘT màu xương duy nhất, và nó phải NHÌN THẤY ĐƯỢC: `surface` trên `paper` chỉ
            1.16:1, tức không có ranh giới nào cả. `mist` là mức thấp nhất còn đọc ra hình. */}
        <div aria-hidden className="mt-md flex flex-col gap-md">
          <div className="h-2xl w-2/3 max-w-measure rounded-md bg-mist" />
          <div className="h-md w-full max-w-measure rounded-md bg-mist" />
          <div className="h-md w-1/2 max-w-measure rounded-md bg-mist" />
        </div>

        {/* Hai cột, không phải ba: khung xương phải mang HÌNH DẠNG của trang nó đang che,
            nếu không thì lúc nội dung thật tới là một cú nhảy. Trang chủ mở đầu bằng
            `grid-cols-[minmax(0,1fr)_18rem]`, và `/cong-dong` cũng vậy. */}
        <div aria-hidden className="mt-xl grid grid-cols-[minmax(0,1fr)_18rem] gap-lg">
          <div className={`${SKELETON_BLOCK} h-3xl`} />
          <div className={`${SKELETON_BLOCK} h-3xl`} />
        </div>
      </div>
    </main>
  );
}
