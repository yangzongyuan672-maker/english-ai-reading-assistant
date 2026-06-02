import "./globals.css";

export const viewport = {
  themeColor: "#111827"
};

export const metadata = {
  title: "Nancy",
  description: "English AI Reading Assistant",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Nancy",
    statusBarStyle: "default"
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
