import './globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HariHariBol Admin',
  description: 'Admin Panel for HariHariBol',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-light text-dark">{children}</body>
    </html>
  );
}
