"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Printer, ChevronLeft } from "./icons";

export function PrintControls({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [auto]);

  return (
    <div className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-paper-edge/30 bg-desk/80 px-4 py-3 backdrop-blur sm:px-6">
      <Link href="/" className="lj-btn lj-btn-ghost">
        <ChevronLeft width={16} height={16} />
        <span className="hidden sm:inline">Back to book</span>
      </Link>
      <p className="hidden text-center font-body text-xs text-[#d8c4a4] sm:block">
        Use your browser&apos;s print dialog and choose{" "}
        <span className="font-semibold">Save as PDF</span>.
      </p>
      <button className="lj-btn" onClick={() => window.print()}>
        <Printer width={16} height={16} />
        Save as PDF
      </button>
    </div>
  );
}
