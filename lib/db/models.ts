import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type NonAttribute,
} from "sequelize";
import { sequelize } from "./sequelize";

/**
 * Model MÔ TẢ bảng đã có, không định nghĩa ra chúng.
 *
 * `db/schema/*.sql` là nguồn sự thật cho DDL và `npm run db:migrate` là thứ duy nhất
 * tạo bảng. **KHÔNG BAO GIỜ gọi `sequelize.sync()`** — nó sẽ đẻ ra một định nghĩa
 * schema thứ hai, trôi dần khỏi bản SQL, và quan trọng hơn: Sequelize không biết gì
 * về RLS, policy, ràng buộc DEFERRABLE hay hàm SECURITY DEFINER, nên bảng nó tự tạo
 * sẽ là bảng KHÔNG CÓ HÀNG RÀO NÀO.
 *
 * `login_codes` cố tình KHÔNG có model: bảng đó chỉ vào được qua hai hàm
 * `app.issue_login_code` / `app.consume_login_code`. Có model là mời gọi người ta
 * truy vấn thẳng, mà quyền thì không cho — chỉ tổ sinh lỗi khó hiểu.
 */

const base = { sequelize, underscored: true, timestamps: false as const };

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare emailVerified: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
}
User.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    email: { type: DataTypes.TEXT, allowNull: false, unique: true },
    emailVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  },
  { ...base, tableName: "users" },
);

export class UserRole extends Model<InferAttributes<UserRole>, InferCreationAttributes<UserRole>> {
  declare userId: string;
  declare role: "user" | "admin";
  declare grantedAt: CreationOptional<Date>;
}
UserRole.init(
  {
    userId: { type: DataTypes.UUID, primaryKey: true },
    role: { type: DataTypes.TEXT, allowNull: false },
    grantedAt: { type: DataTypes.DATE, allowNull: false },
  },
  { ...base, tableName: "user_roles" },
);

export class Shelf extends Model<InferAttributes<Shelf>, InferCreationAttributes<Shelf>> {
  declare slug: string;
  declare name: string;
  declare position: number;
  declare countryCode: string | null;
  declare blurb: CreationOptional<string>;
  declare coverUrl: string | null;
  declare coverSource: string | null;
  declare coverCredit: string | null;
  declare published: CreationOptional<boolean>;
  declare books?: NonAttribute<Book[]>;
}
Shelf.init(
  {
    slug: { type: DataTypes.TEXT, primaryKey: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    countryCode: { type: DataTypes.TEXT },
    blurb: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    coverUrl: { type: DataTypes.TEXT },
    coverSource: { type: DataTypes.TEXT },
    coverCredit: { type: DataTypes.TEXT },
    published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { ...base, tableName: "shelves" },
);

export class Item extends Model<InferAttributes<Item>, InferCreationAttributes<Item>> {
  declare slug: string;
  declare name: string;
  declare description: CreationOptional<string>;
  declare imageUrl: string | null;
  declare imageSource: string | null;
  declare imageCredit: string | null;
}
Item.init(
  {
    slug: { type: DataTypes.TEXT, primaryKey: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    imageUrl: { type: DataTypes.TEXT },
    imageSource: { type: DataTypes.TEXT },
    imageCredit: { type: DataTypes.TEXT },
  },
  { ...base, tableName: "items" },
);

export class Book extends Model<InferAttributes<Book>, InferCreationAttributes<Book>> {
  declare slug: string;
  declare shelfSlug: string;
  declare position: number;
  declare title: string;
  declare era: string;
  declare coverUrl: string | null;
  declare coverSource: string | null;
  declare coverCredit: string | null;
  declare rewardItemSlug: string | null;
  declare published: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare pages?: NonAttribute<Page[]>;
}
Book.init(
  {
    slug: { type: DataTypes.TEXT, primaryKey: true },
    shelfSlug: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.TEXT, allowNull: false },
    era: { type: DataTypes.TEXT, allowNull: false },
    coverUrl: { type: DataTypes.TEXT },
    coverSource: { type: DataTypes.TEXT },
    coverCredit: { type: DataTypes.TEXT },
    rewardItemSlug: { type: DataTypes.TEXT },
    published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  },
  { ...base, tableName: "books" },
);

export class Page extends Model<InferAttributes<Page>, InferCreationAttributes<Page>> {
  declare id: CreationOptional<string>;
  declare bookSlug: string;
  declare position: number;
  declare heading: string;
  declare body: string;
  declare imageUrl: string | null;
  declare imageSource: string | null;
  declare imageCredit: string | null;
  declare caption: string | null;
  declare summary: string[] | null;
}
Page.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    bookSlug: { type: DataTypes.TEXT, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    heading: { type: DataTypes.TEXT, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    imageUrl: { type: DataTypes.TEXT },
    imageSource: { type: DataTypes.TEXT },
    imageCredit: { type: DataTypes.TEXT },
    caption: { type: DataTypes.TEXT },
    // `text[]` của Postgres. MySQL không có kiểu mảng — một trong những lý do dự án ở
    // lại với PostgreSQL thay vì chuyển sang MySQL.
    summary: { type: DataTypes.ARRAY(DataTypes.TEXT) },
  },
  { ...base, tableName: "pages" },
);

export class UserBookProgress extends Model<
  InferAttributes<UserBookProgress>,
  InferCreationAttributes<UserBookProgress>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare bookSlug: string;
  declare currentPage: CreationOptional<number>;
  declare completed: CreationOptional<boolean>;
  declare completedAt: CreationOptional<Date | null>;
}
UserBookProgress.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false },
    bookSlug: { type: DataTypes.TEXT, allowNull: false },
    currentPage: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    // Chỉ `complete_book` (SECURITY DEFINER) đặt được hai cột này — role
    // chronoshelf_auth chỉ có GRANT UPDATE trên riêng cột current_page. Ghi thẳng vào
    // đây từ code ứng dụng sẽ bị Postgres từ chối, đúng như thiết kế.
    completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    completedAt: { type: DataTypes.DATE },
  },
  { ...base, tableName: "user_book_progress" },
);

export class UserItem extends Model<InferAttributes<UserItem>, InferCreationAttributes<UserItem>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare itemSlug: string;
  declare obtainedAt: CreationOptional<Date>;
}
UserItem.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false },
    itemSlug: { type: DataTypes.TEXT, allowNull: false },
    obtainedAt: { type: DataTypes.DATE, allowNull: false },
  },
  { ...base, tableName: "user_items" },
);

/**
 * Nhật ký "ngày nào có học", nguồn của chuỗi giữ lửa (content.md §6).
 *
 * Không có cột `id`: khóa chính là cặp (user_id, active_on), vì câu hỏi duy nhất bảng này
 * trả lời là "hôm đó có học không" và một dòng thừa cho cùng một ngày là vô nghĩa.
 *
 * `DATEONLY` chứ không phải `DATE`: Sequelize trả `DATEONLY` về dưới dạng chuỗi
 * `YYYY-MM-DD` đúng như Postgres lưu, không kèm giờ và không bị múi giờ của tiến trình
 * Node kéo lệch sang ngày khác — mà lệch một ngày ở đây là đứt chuỗi của người dùng.
 */
export class UserActivity extends Model<
  InferAttributes<UserActivity>,
  InferCreationAttributes<UserActivity>
> {
  declare userId: string;
  declare activeOn: string;
}
UserActivity.init(
  {
    userId: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    activeOn: { type: DataTypes.DATEONLY, primaryKey: true, allowNull: false },
  },
  { ...base, tableName: "user_activity" },
);

export class CommunityPost extends Model<
  InferAttributes<CommunityPost>,
  InferCreationAttributes<CommunityPost>
> {
  declare id: CreationOptional<string>;
  declare authorId: string;
  declare kind: "chia-se" | "cau-hoi";
  declare body: string;
  declare createdAt: CreationOptional<Date>;
}
CommunityPost.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true },
    authorId: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.TEXT, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  },
  { ...base, tableName: "community_posts" },
);

export class CommunityComment extends Model<
  InferAttributes<CommunityComment>,
  InferCreationAttributes<CommunityComment>
> {
  declare id: CreationOptional<string>;
  declare postId: string;
  declare authorId: string;
  declare body: string;
  declare createdAt: CreationOptional<Date>;
}
CommunityComment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true },
    postId: { type: DataTypes.UUID, allowNull: false },
    authorId: { type: DataTypes.UUID, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  },
  { ...base, tableName: "community_comments" },
);

// `sourceKey`/`targetKey` là bắt buộc: khóa chính ở đây là `slug` dạng text, không
// phải cột `id` mà Sequelize mặc định giả định.
Shelf.hasMany(Book, { foreignKey: "shelfSlug", sourceKey: "slug", as: "books" });
Book.belongsTo(Shelf, { foreignKey: "shelfSlug", targetKey: "slug", as: "shelf" });
Book.hasMany(Page, { foreignKey: "bookSlug", sourceKey: "slug", as: "pages" });
Page.belongsTo(Book, { foreignKey: "bookSlug", targetKey: "slug", as: "book" });
Book.belongsTo(Item, { foreignKey: "rewardItemSlug", targetKey: "slug", as: "rewardItem" });
