import "../../globals.css";

// Sparad plan ligger utanför [lang]. Språket läses från den sparade posten i steg 5.
export default function SavedPlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
