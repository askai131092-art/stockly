# Stokly — Aplikasi Stock Opname

Aplikasi opname serial number yang mengikuti workbook **SO by SN Master Toko.xlsx**: memuat VEF Master, scan SN per layout, validasi Scan Result (Found / Not In VEF / Duplicate), rekonsiliasi, dan rekap selisih. Data opname disimpan di browser melalui `localStorage`, tanpa backend.

## Menjalankan aplikasi

```sh
npm install
npm run dev
```

Buka URL lokal yang ditampilkan server (umumnya `http://localhost:5173`). Server preview bawaan menghindari batasan native binary Vite/esbuild pada Android/VSCodroid. Untuk Vite desktop gunakan `npm run dev:vite`.

Jika Vite tidak bisa berjalan di Android/VSCodroid karena pembatasan executable native, jalankan `node preview-server.mjs` sebagai alternatif preview. Preview ini membutuhkan koneksi internet untuk memuat React dan ikon dari CDN.

## Fitur

- Impor sheet VEF Master langsung dari XLSX.
- Scan/paste serial number dengan pilihan Layout 1–10.
- Validasi otomatis: Found, Not In VEF, Duplicate.
- Ringkasan progress, daftar master, hasil scan, rekonsiliasi per item code, dan rekap selisih.
- Ekspor master, scan result, dan rekap ke CSV.
- Penyimpanan lokal otomatis per perangkat.