# Cảnh báo sớm bằng luật ASP hiệu chỉnh trên OULAD

> Tài liệu phương pháp của module `backend/src/analytics`. Số đo đánh giá nằm ở
> [risk-evaluation-oulad.md](./risk-evaluation-oulad.md) (sinh tự động, không sửa tay).

## 1. Vì sao không "dùng dữ liệu của app để train app"

UniPrep chưa có dữ liệu học tập thật; dữ liệu seed do chính nhóm sinh ra theo kịch bản. Huấn luyện mô hình
trên dữ liệu đó rồi báo cáo số đo là vòng lặp: mô hình chỉ học lại luật của bộ sinh dữ liệu. Thay vào đó:

1. **Tri thức sư phạm viết thành luật** bằng Answer Set Programming (clingo) — không cần dữ liệu huấn luyện,
   có ngoại lệ, và tự mang giải thích.
2. **Tham số của luật (ngưỡng, trọng số) hiệu chỉnh trên dữ liệu của nơi khác**: OULAD — dữ liệu thật,
   công khai, giấy phép CC BY 4.0, của Open University (Kuzilek, Hlosta & Zdrahal, 2017, *Scientific Data*
   4:170171), ~32 nghìn lượt học, 22 lượt mở của 7 môn.
3. **Đánh giá trên dữ liệu chưa dùng khi hiệu chỉnh** (lượt mở năm sau), nên số đo là thật và kiểm chứng được.
   Dữ liệu seed của UniPrep chỉ dùng để demo giao diện, không xuất hiện trong bất kỳ con số đánh giá nào.

## 2. Định nghĩa bài toán

- **Đơn vị dự đoán:** một lượt học (học viên × khoá) tại một thời điểm `t`. Trên OULAD: `t ∈ {28, 56, 84, 112}`
  ngày từ đầu kỳ; trên UniPrep: thời điểm chạy dự đoán.
- **Nhãn "nguy cơ" (chỉ có trên OULAD):** kết quả cuối khoá `Withdrawn` hoặc `Fail`.
- **Chống rò rỉ:** tại `t` chỉ dùng hoạt động `date ≤ t` và bài nộp `date_submitted ≤ t`; lượt học đã rút trước
  `t` bị loại khỏi mốc đó.

## 3. Feature không phụ thuộc nền tảng

Click trên VLE của Open University không cùng thang với sự kiện UniPrep, nên chỉ dùng đại lượng theo **ngày**
và theo **bài đến hạn** (`risk-features.ts`):

| Feature | OULAD | UniPrep |
|---|---|---|
| `recencyDays` | `t −` ngày có click gần nhất | ngày từ `learning_events` gần nhất |
| `activeDays14`, `activeDaysPrev14` | số ngày có click trong 14 ngày gần nhất / 14 ngày trước đó | số ngày có `learning_events` (giờ Việt Nam) |
| `dueTotal`, `dueMissed` | bài TMA/CMA đã đến hạn / chưa nộp | bài học + quiz có `due_at` đã đến hạn / chưa hoàn thành |
| `lateCount` | nộp sau hạn | hoàn thành bài/nộp quiz sau hạn (`is_late`) |
| `avgScore`, `scoreTrend` | điểm bài (0–100), bài cuối − trung bình trước đó | `score / max_score × 100` của bài đã chấm |
| `daysSinceOnTimeSubmission` | ngày từ lần nộp đúng hạn gần nhất | như bên trái, trên bài học/quiz |

## 4. Chương trình ASP (`risk-rules.ts`)

**Tín hiệu** (mỗi tín hiệu là một luật có ngưỡng `t_*`):

| Tín hiệu | Điều kiện | Ngoại lệ / ưu tiên |
|---|---|---|
| `never_active` | chưa có hoạt động nào | — |
| `inactive` | `recencyDays ≥ t_inactive_days` | **trừ khi** vừa nộp bài đúng hạn trong `t_recent_submission_days` ngày |
| `low_engagement` | `activeDays14 < t_low_active_days` | **trừ khi** "học hiệu quả" (mọi bài đến hạn nộp đúng hạn, điểm ≥ `t_good_score`); bị `inactive` chặn |
| `declining` | hoạt động 14 ngày gần nhất ≤ `t_decline_percent`% của 14 ngày trước | bị `inactive` chặn |
| `missed_work` | `dueMissed ≥ t_missed_min` | — |
| `late_work` | `lateCount ≥ t_late_min` | — |
| `low_score` | `avgScore < t_low_score` | — |
| `score_drop` | `scoreTrend ≤ −t_score_drop` | — |

Ngoại lệ viết bằng phủ định mặc định (`not`) — kết luận bị rút lại khi có bằng chứng ngược — và được in ra
(`exception/3`) để giao diện giải thích cả lý do **không** cảnh báo. Luật cụ thể chặn luật chung để một
nguyên nhân (vắng mặt) không bị đếm ba lần.

**Lập kế hoạch can thiệp** (chỉ khi chạy thật): mỗi học viên có nguy cơ được chọn tối đa một hành động
(`in_app_message` cho nhóm tín hiệu tham gia, `recommended_lesson` cho nhóm bài/điểm, `mentor_assignment` chỉ
khi rủi ro cao và ≥ 3 tín hiệu), không chọn học viên vừa được can thiệp trong 7 ngày, tổng số lượt ≤ `capacity`
(sức xử lý của giảng viên). Mục tiêu tối ưu theo thứ tự: (1) tổng điểm rủi ro được xử lý lớn nhất, (2) hành
động khớp nhiều tín hiệu nhất. Đây là bài toán tổ hợp có ràng buộc — lý do thật sự để dùng ASP thay vì if-else.

Chạy bằng `clingo-wasm` (clingo 5.8 biên dịch WebAssembly) ngay trong tiến trình Node: không cần cài clingo,
Python hay dịch vụ ngoài trong container.

## 5. Hiệu chỉnh (`npm run oulad:calibrate`)

1. **Ngưỡng từng luật:** quét lưới trên tập hiệu chỉnh (lượt mở 2013B, 2013J), chọn giá trị tối đa hoá Youden
   J = TPR − FPR của riêng luật đó.
2. **Chạy chương trình ASP thật** trên toàn bộ dữ liệu để lấy tín hiệu từng lượt học.
3. **Gộp điểm:** hồi quy logistic trên vector "tín hiệu bật/tắt": `score = σ(b + Σ w_r)`. Trọng số `w_r`
   chính là mức đóng góp (log-odds) hiển thị cạnh mỗi lý do — giải thích khớp đúng cách tính điểm.
4. **Ngưỡng điểm:** "trung bình" tối đa F1 trên tập hiệu chỉnh; "cao" là điểm nhỏ nhất đạt precision ≥ 0,85.
   Khoá học có `alert_settings` (scope `course`) thì dùng ngưỡng đó thay thế.
5. **Đánh giá** trên lượt mở 2014B, 2014J; so với hồi quy logistic trên 12 feature liên tục (mô hình "hộp
   đen" tham chiếu), theo từng mốc dự đoán, và đo **thời gian báo trước** so với ngày rút môn.

Kết quả lưu vào `backend/src/analytics/risk/risk-calibration.json` (được commit, runtime đọc) và báo cáo
`risk-evaluation-oulad.md`. Dữ liệu OULAD và `features.jsonl` **không** commit; tái lập bằng:

```bash
# tải và giải nén OULAD (CC BY 4.0) vào một thư mục ngoài repo
curl -L -o oulad.zip "https://archive.ics.uci.edu/static/public/349/open+university+learning+analytics+dataset.zip"
unzip oulad.zip -d <OULAD_DIR>
cd backend
npm run oulad:features -- <OULAD_DIR>    # ~20 giây, đọc 10,6 triệu dòng studentVle theo luồng
npm run oulad:calibrate -- <OULAD_DIR>   # ~20 giây, gồm ~60 lần giải clingo
```

## 6. Luồng chạy trong UniPrep

`GET /api/analytics/courses/:id/dashboard|risks` → nếu dự đoán gần nhất cũ hơn 12 giờ thì chạy lại
(`RiskService.runForCourse`) → `RiskFeatureService` tính feature từ DB → `RiskEngineService` chạy ASP + gộp điểm
→ ghi `risk_predictions` (`is_current`, `feature_snapshot` gồm feature, tín hiệu, lý do, ngoại lệ) gắn với bản ghi
`model_versions` `risk-asp-oulad@<version>`. Giảng viên chọn học viên → backend soạn nháp (DeepSeek, mọi con số
trong tin phải có trong snapshot, sai thì dùng mẫu) → giảng viên sửa và gửi → `interventions` + thông báo.
Học viên mở thông báo ⇒ `acknowledged`; sau 7 ngày, kết quả (`improved` / `no_change` / `worsened`) được tự
chấm bằng cách so điểm rủi ro lúc gửi với điểm hiện tại.

## 7. Giới hạn đã biết

- **Chuyển miền:** ngưỡng học từ khoá đại học từ xa ở Anh (OULAD) áp cho khoá trên UniPrep. Feature đã được
  chọn để không phụ thuộc nền tảng, nhưng nhịp học khác nhau (khoá ngắn vs học kỳ 9 tháng) vẫn có thể làm lệch
  ngưỡng ngày. Khoá học có thể ghi đè ngưỡng điểm qua `alert_settings`.
- **Nhãn khác bản chất:** trên OULAD là "rút/trượt cuối kỳ"; trong UniPrep chưa có nhãn này nên không đo được
  độ chính xác trên dữ liệu của chính hệ thống — chỉ đo được trên OULAD.
- **Bộ luật kém mô hình hộp đen một chút** (xem báo cáo): đó là cái giá của tính giải thích được và của việc
  không cần dữ liệu huấn luyện riêng.
- **Kết quả can thiệp tự chấm** là so sánh trước/sau, không phải thí nghiệm có nhóm đối chứng — không kết luận
  được quan hệ nhân quả.
