# Đánh giá bộ cảnh báo sớm ASP trên OULAD

> Tệp này được sinh tự động bởi `npm run oulad:calibrate` (2026-11-14T09:14:08.222Z). Không sửa tay — sửa
> script rồi chạy lại. Phương pháp: [risk-asp-oulad.md](./risk-asp-oulad.md).

## Dữ liệu

- Bộ dữ liệu: Open University Learning Analytics Dataset (OULAD) — CC BY 4.0 — Kuzilek, Hlosta & Zdrahal (2017), Scientific Data 4:170171.
- Nhãn "nguy cơ": `final_result ∈ {Withdrawn, Fail}`. Mốc dự đoán: ngày 28, 56, 84, 112 kể từ đầu kỳ.
- Hiệu chỉnh (train): lượt mở 2013B, 2013J — 45134 dòng, tỉ lệ nguy cơ 41.8%.
- Đánh giá (test): lượt mở 2014B, 2014J — 59551 dòng, tỉ lệ nguy cơ 40.8%.
- Thời gian chạy clingo-wasm: train 2.4 s, test 3.0 s (lô 2000 học viên/lần giải). Số lần ngoại lệ được áp dụng trên test: 6161.

## Ngưỡng luật (chọn trên train theo Youden J)

| Tham số | Giá trị | Youden J |
|---|---|---|
| `inactiveDays` | 9 | 0.226 |
| `recentSubmissionDays` | 7 | 0.228 |
| `lowActiveDays` | 3 | 0.237 |
| `goodScore` | 70 | 0.275 |
| `decline` | {"percent":25,"minPrev":3} | 0.003 |
| `missedMin` | 1 | 0.327 |
| `lateMin` | 1 | 0.009 |
| `lowScore` | 70 | 0.214 |
| `scoreDrop` | 15 | 0.039 |

## Trọng số gộp (hồi quy logistic trên tín hiệu, train)

Hệ số chặn: -1.321. Ngưỡng điểm: trung bình ≥ 0.296 (tối đa F1 trên train), cao ≥ 0.674 (precision train ≥ 0.85).

| Tín hiệu | Trọng số (log-odds) | Tỉ lệ bật trên test | Precision trên test |
|---|---|---|---|
| `never_active` | 1.659 | 2.1% | 90.0% |
| `inactive` | 0.910 | 26.1% | 63.1% |
| `low_engagement` | 0.372 | 12.0% | 49.8% |
| `declining` | 0.057 | 2.8% | 35.6% |
| `missed_work` | 1.799 | 19.4% | 78.4% |
| `late_work` | 0.026 | 33.5% | 43.9% |
| `low_score` | 1.138 | 25.0% | 59.7% |
| `score_drop` | 0.408 | 10.3% | 43.6% |

## Kết quả trên tập test (2014B, 2014J)

| Phương pháp | AUC | Precision | Recall | F1 |
|---|---|---|---|---|
| ASP + gộp logistic (mức ≥ trung bình) | 0.760 | 59.4% | 74.6% | 0.661 |
| ASP + gộp logistic (chỉ mức cao) | — | 83.8% | 38.4% | 0.526 |
| ASP thuần, "có ít nhất một tín hiệu" (không học trọng số) | 0.715¹ | 49.3% | 86.3% | 0.628 |
| Tham chiếu: hồi quy logistic trên 12 feature liên tục | 0.796 | 59.0% | 79.2% | 0.677 |

¹ AUC tính theo số tín hiệu bật.

Ma trận nhầm lẫn (ASP, mức ≥ trung bình): TP 18129, FP 12405, FN 6165, TN 22852.

### Theo mốc dự đoán (càng sớm càng khó)

| Mốc (ngày) | Số dòng | Tỉ lệ nguy cơ | AUC ASP | F1 ASP | AUC tham chiếu | F1 tham chiếu |
|---|---|---|---|---|---|---|
| 28 | 15720 | 43.9% | 0.705 | 0.623 | 0.719 | 0.648 |
| 56 | 15087 | 41.6% | 0.763 | 0.671 | 0.790 | 0.675 |
| 84 | 14589 | 39.6% | 0.792 | 0.656 | 0.823 | 0.688 |
| 112 | 14155 | 37.7% | 0.839 | 0.698 | 0.856 | 0.704 |

### Thời gian báo trước

Trong 3014 lượt học rút môn (có ngày rút) của tập test, 2595 lượt
được gắn cờ ở một mốc **trước** ngày rút; trung vị thời gian báo trước là 68 ngày.
