# FREIGHT_CALC

เครื่องคิดราคาขายค่าระวาง + ขนส่ง สำหรับ RCN Logistics
ชุดราคาทั้งหมด sync ผ่าน Supabase — ใช้ได้หลายเครื่อง

## Setup ครั้งแรก

### 1. รัน SQL schema ใน Supabase
เปิด Supabase Dashboard → SQL Editor → รันไฟล์ `supabase-schema.sql`
(มี seed 3 ชุดราคาเริ่มต้น 17/21/24 มี.ค. 2569)

### 2. เปิด GitHub Pages
- Repo settings → Pages → Source: `Deploy from a branch`
- Branch: `main` / folder: `/ (root)`
- รอประมาณ 1 นาที จะได้ URL `https://oakrcniii.github.io/FREIGHT_CALC/`

## ใช้งาน

- Login: ใช้ user/pass เดียวกับ ENTRY_ANTS (`OAK_THIRA`, `YAI_THIRA`, `ANTS_THIRA`)
- ทุกการแก้ไขชุดราคา (เพิ่ม/แก้/ลบ) sync ขึ้น Supabase อัตโนมัติ
- Sync indicator มุมขวาบน:
  - 🟢 SYNCED — ปกติ
  - 🟡 SYNCING — กำลัง sync
  - ⚫ OFFLINE — เน็ตหลุด (ใช้ cache ได้)
  - 🔴 ERROR — เกิดข้อผิดพลาด

## Files

- `index.html` — แอปทั้งหมด (single-file)
- `supabase-schema.sql` — schema + seed data
