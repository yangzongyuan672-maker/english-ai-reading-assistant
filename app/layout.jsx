import "./globals.css";

export const metadata = {
  title: "English AI Reading Assistant",
  description: "英文内容智能翻译助手"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
