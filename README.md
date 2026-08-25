# 班主任工作台

這是一個供單一班主任在平板與電腦使用的響應式工作台，包含今日總覽、出缺勤、待辦、學生名冊、座位表、個案紀錄、課表、JSON 備份與 CSV 匯出。

## 網站

https://tommyjerrykic-ai.github.io/class-teacher-desk/

## 啟用雲端同步

1. 在 Supabase 建立專案。
2. 開啟 SQL Editor，執行 supabase/schema.sql 的全部內容，以建立資料表、索引與 Row Level Security。
3. 在 Authentication 啟用 Email／Password；老師帳號建立完成後，建議關閉公開註冊。
4. 將專案 URL 與 Publishable／Anon Key 填入工作台的「連接 Supabase」畫面。這兩項是公開前端連線資訊，請勿填入 service_role 或其他管理員密鑰。
5. 在 Supabase 的 URL Configuration 加入工作台正式網址，密碼重設信才能正確返回工作台。

在尚未連接 Supabase 前，可使用示範模式檢查所有介面與操作；示範資料只保存在目前裝置，不會跨裝置同步。
