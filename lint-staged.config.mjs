// Cấu hình lint-staged ở gốc repo.
//
// Vì sao KHÔNG dùng `cd backend && npx eslint ...` như tài liệu lint-staged gợi ý:
// lint-staged v16 chạy task qua `tinyexec` **không có shell** (xem
// `node_modules/lint-staged/lib/getSpawnedTask.js` — nó tự tách chuỗi lệnh rồi spawn).
// Trên Windows, chuỗi có `&&` bị đẩy qua `cmd.exe` với ký tự meta bị escape nên cmd báo
// "The filename, directory name, or volume label syntax is incorrect" — hook đỏ dù code sạch.
//
// Vì sao gọi `node <đường dẫn bin>` thay vì `eslint`/`prettier`: `node` là file .exe nên
// tinyexec spawn trực tiếp, không qua cmd; còn `eslint` trong node_modules/.bin là .cmd nên
// vẫn phải qua cmd. Gọi qua `node` là cách duy nhất chạy được trên cả Windows và Linux/macOS.
//
// Vì sao phải truyền `--config`: task chạy ở gốc repo (không có `eslint.config.*`), nên ESLint
// phải được trỏ tường minh tới config của từng package. Prettier thì tự tìm `.prettierrc` theo
// đường dẫn từng file nên không cần cờ nào.
//
// Giới hạn đã biết: đường dẫn file được truyền không bọc nháy, nên hook sẽ sai nếu repo được
// clone vào thư mục có dấu cách. Khi đó dùng `lint-staged --relative` + viết lại task theo
// đường dẫn tương đối tính từ gốc repo.
const list = (files) => files.join(' ');

export default {
	// Backend: ESLint có kèm plugin prettier nên `eslint --fix` đã xử lý format TS;
	// vẫn chạy prettier để format cả file .json/.md khi chúng được stage.
	'backend/**/*.ts': (files) => [
		`node backend/node_modules/eslint/bin/eslint.js --config backend/eslint.config.mjs --fix ${list(files)}`,
		`node backend/node_modules/prettier/bin/prettier.cjs --write ${list(files)}`,
	],
	'backend/**/*.{json,md}': (files) => [
		`node backend/node_modules/prettier/bin/prettier.cjs --write ${list(files)}`,
	],
	// Frontend: ESLint KHÔNG cấu hình plugin prettier (tránh trùng lint), nên prettier
	// phải chạy thành bước riêng.
	'frontend/**/*.{ts,tsx}': (files) => [
		`node frontend/node_modules/eslint/bin/eslint.js --config frontend/eslint.config.js --fix ${list(files)}`,
		`node frontend/node_modules/prettier/bin/prettier.cjs --write ${list(files)}`,
	],
	'frontend/**/*.{css,json,md}': (files) => [
		`node frontend/node_modules/prettier/bin/prettier.cjs --write ${list(files)}`,
	],
};
