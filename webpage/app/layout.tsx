import type { Metadata } from "next";
import { JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-mono',
});

const sora = Sora({ 
  subsets: ["latin"],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: "s7lver2 - Developer Portfolio",
  description: "Portfolio de proyectos y tecnologías",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${jetbrainsMono.variable} ${sora.variable} font-mono antialiased`}>
        {children}
      </body>
    </html>
  );
}
