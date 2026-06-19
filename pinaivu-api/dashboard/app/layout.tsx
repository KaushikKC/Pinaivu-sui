import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pinaivu — Developer Console",
  description: "API key management, usage analytics, and model catalog",
  icons: { icon: "/Pinaivu_logo.jpg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full overflow-hidden">
        <div className="h-full flex">
          <aside className="w-60 shrink-0 bg-surface-1 border-r border-surface-2/50 flex flex-col py-4 px-3">
            <div className="mb-6 px-2 flex items-center gap-2.5">
              <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-7 h-7 rounded-lg" />
              <div>
                <span className="text-sm font-semibold text-zinc-100 tracking-tight">Pinaivu</span>
                <p className="text-[10px] text-zinc-500">Developer Console</p>
              </div>
            </div>

            <nav className="flex flex-col gap-0.5">
              <NavLink href="/" label="Overview" />
              <NavLink href="/keys" label="API Keys" />
              <NavLink href="/usage" label="Usage" />
              <NavLink href="/models" label="Models" />
            </nav>

            <div className="mt-auto pt-3 border-t border-surface-2/50">
              <NavLink href="/setup" label="Setup" />
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto p-8 bg-surface">{children}</main>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-surface-2 transition-colors"
    >
      {label}
    </Link>
  );
}
