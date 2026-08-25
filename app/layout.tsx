import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '班主任工作台',
  description: '班主任每日課表、出缺勤、待辦與學生追蹤的一站式工作台。',
  openGraph: {
    title: '班主任工作台',
    description: '課表・出勤・待辦・學生追蹤，一處完成。',
    type: 'website',
    images: process.env.SITE_URL
      ? [{ url: new URL('/og.png', process.env.SITE_URL).toString(), width: 1732, height: 909, alt: '班主任工作台' }]
      : [],
  },
  twitter: {
    card: 'summary_large_image',
    title: '班主任工作台',
    description: '課表・出勤・待辦・學生追蹤，一處完成。',
    images: process.env.SITE_URL ? [new URL('/og.png', process.env.SITE_URL).toString()] : [],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
