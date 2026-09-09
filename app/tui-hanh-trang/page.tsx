import Link from "next/link";
import type { Metadata } from "next";
import { Award, BookOpen, Check, ChevronRight, Droplet, Sparkles } from "lucide-react";
import { AnhVatPham } from "@/components/ui/AnhVatPham";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import {
  FOCUS_RING_ON_SURFACE,
  PRIMARY_BUTTON,
  QUIET_BUTTON_ON_SURFACE,
} from "@/components/ui/controls";
import s from "@/components/bag/bag.module.scss";
import { manhGhep } from "@/lib/tranh-ghep";
import {
  readTuiHanhTrang,
  type BoSuuTapKe,
  type VatPhamTuiHanhTrang,
} from "@/lib/content/read";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Túi hành trang — Cửa Sổ Lịch Sử",
};

/**
 * Một ô trong tủ kính.
 *
 * Bố cục DỌC và căn giữa, không phải một hàng ngang [icon nhỏ][tên][mũi tên]: ở bố cục
 * ngang, cột tên chỉ còn ~125px nên tên vật phẩm xuống hai ba dòng và ba ô cùng hàng cao
 * 96 / 104 / 130px — mép dưới răng cưa đọc ra là một danh sách bị lỗi chứ không phải một
 * tủ trưng bày. Dựng đứng lên thì cột tên rộng bằng cả ô, và vật phẩm (bệ 96px thay vì
 * 64px) thành nhân vật chính của ô thay vì một icon phụ bên trái.
 *
 * BA TÍN HIỆU phân biệt "đã có" với "chưa có", và cả ba phải có mặt ở CẢ BỐN tổ hợp
 * (có ảnh / không ảnh) × (đã có / chưa có): huy hiệu góc bệ, hình vật phẩm, và dòng chữ
 * trạng thái.
 *
 * Huy hiệu góc trước đây chỉ vẽ khi ĐÃ CÓ, nên ô "chưa có nhưng có ảnh" không mang tín hiệu
 * đồ họa nào ngoài một bóng mờ 1.25:1, trong khi hàng chú giải phía dưới lại dạy người dùng
 * rằng có một dấu hiệu để tìm. Nay huy hiệu có hai trạng thái, nên lời hứa ở chú giải đúng
 * với mọi ô.
 *
 * Ô CHƯA CÓ mang một GIỌT MỰC rỗng, không phải ổ khóa — DESIGN.md § Ink: "Chưa mở khóa =
 * nước chưa nhuộm. Không phải ổ khóa, không phải xiềng." Cùng hình mà màn kệ sách dùng cho
 * quyển chưa mở, nên hai màn nói cùng một chuyện bằng cùng một từ vựng.
 *
 * Nền giữ `bg-surface` ở CẢ HAI trạng thái. Đổi ô chưa có sang `bg-mist` cho
 * giống bìa sách đang khóa nghe hợp lý nhưng sai: phần mô tả bên trong dùng `text-ink-dilute`,
 * trên nền đó chỉ còn 1.76:1.
 */
function OVatPham({ v }: { v: VatPhamTuiHanhTrang }) {
  return (
    <li>
      {/* `h-full` là bước không được bỏ: `<li>` là ô lưới nên nó tự giãn theo hàng, còn
          `<details>` bên trong vẫn cao đúng bằng nội dung của nó — thiếu dòng này thì hàng
          vẫn rách y như cũ dù đã bỏ `items-start` khỏi `<ul>`. */}
      {/* `name` biến `<details>` thành accordion LOẠI TRỪ — mở một thẻ tự đóng thẻ đang
          mở. Có sẵn trong HTML, 0 dòng JS, và trình duyệt cũ bỏ qua thuộc tính chứ không
          hỏng. Cần nó vì `<li>` là ô lưới: mở một mô tả làm CẢ HÀNG cao thêm ~160px, mà
          2–3 thẻ còn lại trong hàng chỉ dôi ra khoảng trắng. */}
      <details name="tui-hanh-trang" className={`${s.o} h-full rounded-md border border-mist bg-surface p-md`}>
        <summary className={`flex flex-col items-center gap-sm rounded-sm text-center ${FOCUS_RING_ON_SURFACE}`}>
          <span className="relative grid h-24 w-24 shrink-0 place-items-center rounded-sm bg-mist">
            {v.image ? (
              // Màu do `text-*` ở đây quyết định, không do file ảnh — xem `AnhVatPham`.
              <AnhVatPham
                src={v.image}
                mo={!v.daCo}
                className={`h-16 w-16 ${v.daCo ? "text-son" : "text-feathered"}`}
              />
            ) : v.daCo ? (
              <Sparkles aria-hidden className="h-10 w-10 text-son" />
            ) : (
              // Giọt mực chưa loang — cùng hình mà `ShelfBasin` dùng cho quyển chưa mở.
              <Droplet aria-hidden className="h-10 w-10 text-ink-dilute" />
            )}

            <span
              aria-hidden
              className={`absolute -right-sm -top-sm grid h-lg w-lg place-items-center rounded-full ${
                v.daCo ? "bg-primary" : "bg-mist"
              }`}
            >
              {v.daCo ? (
                <Check className="h-3.5 w-3.5 text-on-ink" />
              ) : (
                <Droplet className="h-3.5 w-3.5 text-ink-dilute" />
              )}
            </span>
          </span>

          {/* Chốt hai dòng: 6/9 tên vật phẩm xuống dòng thứ hai còn 3 tên thì không, nên
              nếu để chiều cao tự do thì dòng trạng thái của các thẻ cùng hàng lệch nhau
              đúng một dòng chữ. `h-full` chỉ làm bằng MÉP DƯỚI của thẻ, không làm bằng
              các hàng bên trong nó. */}
          <span className="flex min-h-[2lh] items-center font-ui text-title-md text-primary">
            {v.name}
          </span>

          <span
            className={`inline-flex items-center gap-xs font-ui text-body-sm ${v.daCo ? "text-son" : "text-ink-dilute"}`}
          >
            {v.daCo ? "Đã sưu tầm" : "Chưa có"}
            {/* Tam giác đóng/mở của `<details>`, xoay 90° khi mở (`bag.module.scss`). Đặt
                sát dòng trạng thái chứ không dạt ra mép phải ô: ở mép phải nó đọc ra là
                "đi tới trang khác", cạnh chữ thì nó đọc ra là "bung phần mô tả". */}
            <ChevronRight aria-hidden className={`${s.mui} h-4 w-4 shrink-0`} />
          </span>
        </summary>

        <div className="mt-md border-t border-ink-dilute pt-md">
          <p className="font-ui text-body-sm text-ink-dilute">{v.description}</p>

          {v.tuQuyen && (
            <Link
              href={`/${v.tuQuyen.shelfSlug}`}
              // Trước đây là bản chép tay của `QUIET_BUTTON` đã RƠI MẤT `transition`,
              // `hover:decoration-2` và `active:brightness-90` — nút chữ duy nhất trong
              // ứng dụng không phản hồi khi rê chuột hay khi bấm.
              className={`mt-sm ${QUIET_BUTTON_ON_SURFACE}`}
            >
              <BookOpen aria-hidden className="h-4 w-4" />
              {v.daCo ? `Từ quyển “${v.tuQuyen.title}”` : `Đọc “${v.tuQuyen.title}” để nhận`}
            </Link>
          )}

          {/* Ghi công ảnh — cùng điều kiện BY như mọi chỗ khác có ảnh. */}
          {v.image && (
            <GhiCongAnh
              credit={v.imageCredit}
              nguon={v.imageSource}
              className="mt-sm text-ink-dilute"
            />
          )}
        </div>
      </details>
    </li>
  );
}

/**
 * Bức tranh toàn cảnh của một kệ, ghép từ các mảnh (content.md §4.4).
 *
 * Hé lộ DẦN chứ không chỉ hiện khi đã đủ: đó mới là thứ tạo động lực sưu tầm. Mảnh thứ k
 * lấy đúng dải dọc thứ k của bức tranh — hình học nằm ở `lib/tranh-ghep.ts` và có test
 * riêng, vì mẫu số `tong - 1` là chỗ dễ viết sai mà nhìn ảnh thì không thấy ngay.
 *
 * Cả dải ảnh là TRANG TRÍ (`aria-hidden`): thông tin thật nằm ở `<figcaption>` ngay dưới,
 * viết bằng chữ. Một trình đọc màn hình không có gì để nói về bốn ô nền CSS.
 */
function TranhGhep({ bo }: { bo: BoSuuTapKe }) {
  const tranh = bo.tranh;
  if (!tranh) return null;

  const tong = bo.vatPham.length;
  const daMo = bo.vatPham.filter((v) => v.daCo).length;

  return (
    <figure className="mt-md">
      <div
        aria-hidden
        className={s.tranh}
        style={{ gridTemplateColumns: `repeat(${tong}, minmax(0, 1fr))` }}
      >
        {bo.vatPham.map((v, k) =>
          v.daCo ? (
            <div
              key={v.slug}
              className={s.manh}
              // `tranh.url` đã qua `readImageFields()` nên luôn khớp `/media/<sha256>` —
              // không có ký tự nào thoát được ra khỏi cặp ngoặc kép của `url()`.
              style={{ ...manhGhep(k, tong), backgroundImage: `url("${tranh.url}")` }}
            />
          ) : (
            <div key={v.slug} className={s.manhChua}>
              {/* `h-8` chứ không `h-4`: mảnh tranh cao 132px, một icon 16px ở giữa đọc ra
                  là một hạt bụi. Vẫn dưới 25% chiều cao mảnh nên không che vân giấy. */}
              <Droplet className="h-8 w-8 text-ink-dilute" />
            </div>
          ),
        )}
      </div>

      <figcaption className="mt-sm font-ui text-caption text-ink-dilute">
        {bo.tronBo
          ? "Bức tranh toàn cảnh đã liền lại — bạn giữ đủ mọi mảnh của kệ này."
          : `Bức tranh toàn cảnh: đã ghép ${daMo}/${tong} mảnh. Mỗi quyển đọc xong thả ra một mảnh.`}
        <GhiCongAnh credit={tranh.credit} nguon={tranh.source} className="mt-xs block text-ink-dilute" />
      </figcaption>
    </figure>
  );
}

/**
 * Phần thưởng khi sưu tầm trọn một bộ (content.md §4.5).
 *
 * Nội dung thưởng KHÔNG đi qua đây khi chưa đủ: `readTuiHanhTrang()` để `phanThuong` là
 * null cho tới lúc đủ, nên component này không có nhánh nào in ra chữ chưa kiếm được.
 * Lời mời gọi thì đọc `coPhanThuong` — nó biết CÓ phần thưởng, không biết nó là gì.
 */
function PhanThuongTronBo({ bo }: { bo: BoSuuTapKe }) {
  if (!bo.coPhanThuong) return null;

  if (!bo.phanThuong) {
    const conThieu = bo.vatPham.filter((v) => !v.daCo).length;
    return (
      <p className="mt-md flex items-center gap-sm rounded-md bg-surface px-md py-sm font-ui text-body-sm text-ink-dilute">
        {/* `text-ink-dilute`, KHÔNG phải `secondary-light`: khối này nền `surface` (sáng),
            mà `secondary-light` là cặp dành cho nền TỐI — trên nền sáng nó chỉ 1.53:1, và
            chính `DESIGN.md` đã loại nó vì đúng con số đó. */}
        <Droplet aria-hidden className="h-4 w-4 shrink-0 text-ink-dilute" />
        Còn {conThieu} vật phẩm nữa là mở khóa danh hiệu của kệ này.
      </p>
    );
  }

  return (
    <div className="mt-md rounded-md bg-surface p-md">
      <p className="flex items-center gap-sm font-ui text-label-caps uppercase text-son">
        <Award aria-hidden className="h-4 w-4 shrink-0" />
        Danh hiệu đã mở khóa
      </p>
      {/* `<h3>`: danh hiệu là đích đến của cả cơ chế sưu tầm, nó phải là một mốc điều
          hướng chứ không phải một đoạn văn. Trang đi h1 → h2 (mỗi kệ) → h3 (phần thưởng). */}
      <h3 className="mt-xs font-ui text-title-md text-primary">
        {bo.phanThuong.danhHieu}
      </h3>
      {bo.phanThuong.noiDung && (
        // `whitespace-pre-line`: admin gõ nội dung thưởng trong một `<textarea>`, nên chỗ
        // họ xuống dòng phải xuống dòng thật chứ không bị gộp thành một khối chữ liền.
        //
        // `text-primary` (13.22:1), không phải `text-ink-dilute` (5.22:1): DESIGN.md
        // xếp `secondary` vào vai "chữ phụ, caption, metadata", mà đây là một bài viết để
        // ĐỌC — phần thưởng của cả bộ sưu tập không được mang tông của chú thích ảnh.
        <p className="mt-sm max-w-measure whitespace-pre-line font-ui text-body-md text-primary">
          {bo.phanThuong.noiDung}
        </p>
      )}
    </div>
  );
}

/**
 * Túi hành trang — tủ kính bảo tàng trưng bày toàn bộ vật phẩm đã sưu tầm (content.md §4.5).
 *
 * Ô của vật phẩm CHƯA có vẫn hiện, dưới dạng bóng mờ: đó là cả điểm của trang này. Một tủ
 * chỉ hiện thứ mình đã có thì không nói được còn bao nhiêu thứ đang chờ.
 *
 * Phần "bấm để xem mô tả" dùng `<details>` chứ không phải state React: đóng/mở, thao tác
 * bàn phím và ngữ nghĩa cho trình đọc màn hình đều có sẵn trong thẻ, 0 dòng JS.
 *
 * Việc gom vật phẩm theo BỘ nằm ở `readTuiHanhTrang()` chứ không ở đây: một bộ không chỉ
 * là một nhóm hiển thị nữa, nó còn quyết định đã trọn bộ hay chưa — và câu trả lời đó là
 * thứ khóa nội dung thưởng lại. Để nó ở tầng đọc thì trang này không có đường nào in ra
 * phần thưởng chưa kiếm được, kể cả khi ai đó viết nhầm.
 */
export default async function TuiHanhTrang() {
  // Hai lời gọi TUẦN TỰ, không `Promise.all` — cả hai đều mở transaction Sequelize.
  const { vatPham, boSuuTap, chuaGanKe, daDangNhap } = await readTuiHanhTrang();

  const soDaCo = vatPham.filter((v) => v.daCo).length;

  return (
    <main id="noi-dung" className="min-w-0 flex-1 px-page-margin py-xl">
      {/* `max-w-5xl` (1024px) — cùng bề rộng cột nội dung với trang chủ, /cong-dong và
          /bai-giang, để lề trái của <h1> không nhảy ngang khi bấm qua lại giữa chúng. */}
      <div className="mx-auto max-w-5xl">
        <p className="font-ui text-label-caps uppercase text-son">Bộ sưu tập</p>
        <h1 className="mt-sm font-ui text-display-lg text-primary">Túi hành trang</h1>
        <p className="mt-sm max-w-measure font-ui text-body-md text-ink-dilute">
          {daDangNhap
            ? `Bạn đang giữ ${soDaCo}/${vatPham.length} vật phẩm. Mỗi thứ ở đây là dấu vết của một quyển sách bạn đã đọc xong.`
            : "Đăng nhập để bắt đầu sưu tầm. Mỗi quyển sách đọc xong sẽ thả ra một vật phẩm, và chính nó mở khóa quyển tiếp theo."}
        </p>

        {daDangNhap ? (
          vatPham.length > 0 && (
            // Đây là trang duy nhất trả lời "tôi đã đi được bao xa", và câu trả lời từng
            // được giao trọn cho một con số 14px màu nâu nhạt — ở dạng chữ thuần thì
            // 4/13 và 11/13 gây ra cùng một cảm xúc. `aria-hidden` vì đúng con số đó nằm
            // trong câu ngay trên, trình đọc màn hình không mất gì.
            <div aria-hidden className={`${s.thuoc} mt-md max-w-measure`}>
              <div
                className={s.thuocDay}
                style={{ width: `${(soDaCo / vatPham.length) * 100}%` }}
              />
            </div>
          )
        ) : (
          // Câu trên bảo "đăng nhập để bắt đầu sưu tầm" nhưng không có gì bấm được để
          // làm việc đó. `next` đưa người dùng quay lại đúng trang này sau khi vào.
          <Link href="/dang-nhap?next=/tui-hanh-trang" className={`${PRIMARY_BUTTON} mt-md`}>
            Đăng nhập
          </Link>
        )}

        {vatPham.length === 0 ? (
          <p className="mt-lg font-ui text-body-md text-ink-dilute">
            Chưa có vật phẩm nào.
          </p>
        ) : (
          <div className="mt-lg">
            {boSuuTap.map((bo, i) => (
              <section
                key={bo.slug}
                className={i > 0 ? "mt-xl" : undefined}
                aria-labelledby={`nhom-${bo.slug}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-md">
                  <h2
                    id={`nhom-${bo.slug}`}
                    className="font-ui text-title-md text-primary"
                  >
                    {bo.name}
                  </h2>
                  <p className="font-ui text-body-sm text-ink-dilute">
                    {bo.vatPham.filter((v) => v.daCo).length}/{bo.vatPham.length} vật phẩm
                  </p>
                </div>

                <TranhGhep bo={bo} />

                {/* Không `items-start`: ô lưới giãn theo hàng, cộng `h-full` trên
                    `<details>` thì mọi ô cùng hàng có chung mép dưới. */}
                <ul className="mt-md grid grid-cols-3 gap-md">
                  {bo.vatPham.map((v) => (
                    <OVatPham key={v.slug} v={v} />
                  ))}
                </ul>

                <PhanThuongTronBo bo={bo} />
              </section>
            ))}

            {/* Vật phẩm chưa quyển nào thưởng ra, hoặc thưởng bởi quyển thuộc kệ mà RLS
                đang giấu. Vẫn phải hiện: nếu bỏ, tổng "x/13" ở trên không khớp số ô đếm
                được bên dưới. */}
            {chuaGanKe.length > 0 && (
              <section
                className={boSuuTap.length > 0 ? "mt-xl" : undefined}
                aria-labelledby="nhom-khac"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-md">
                  <h2 id="nhom-khac" className="font-ui text-title-md text-primary">
                    Chưa thuộc bộ nào
                  </h2>
                  <p className="font-ui text-body-sm text-ink-dilute">
                    {chuaGanKe.filter((v) => v.daCo).length}/{chuaGanKe.length} vật phẩm
                  </p>
                </div>
                <ul className="mt-md grid grid-cols-3 gap-md">
                  {chuaGanKe.map((v) => (
                    <OVatPham key={v.slug} v={v} />
                  ))}
                </ul>
              </section>
            )}

            {/* Hàng chú giải, sao khuôn từ màn kệ sách: hai trạng thái được nói bằng CHỮ
                một lần, để người xem không phải tự suy ra ý nghĩa của dấu triện và giọt
                mực từ mười ba cái ô. */}
            <p className="mt-xl flex flex-wrap items-center gap-lg border-t border-mist pt-md font-ui text-caption text-ink-dilute">
              <span className="inline-flex items-center gap-xs">
                <span
                  aria-hidden
                  className="grid h-lg w-lg shrink-0 place-items-center rounded-full bg-primary"
                >
                  <Check className="h-3.5 w-3.5 text-on-ink" />
                </span>
                Đã sưu tầm — dấu triện ở góc vật phẩm
              </span>
              <span className="inline-flex items-center gap-xs">
                <Droplet aria-hidden className="h-4 w-4 shrink-0 text-ink-dilute" />
                Chưa có — đọc quyển sách tương ứng để nhận
              </span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
