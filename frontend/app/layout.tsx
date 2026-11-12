export const metadata = { title: "Samiksha", description: "Every stock, reviewed — both sides, with sources." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "40px auto", padding: "0 16px" }}>{children}</body>
    </html>
  );
}
