"use client";

import { useEffect, useRef, useState } from "react";

// Compact title inside the sticky header, visible only while the page's
// real heading (id="page-heading") is scrolled out of view.
export function StickyTitle({ title }: { title: string }) {
  const [visible, setVisible] = useState(false);
  const selfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const heading = document.getElementById("page-heading");
    if (!heading) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: "-90px 0px 0px 0px" }
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={selfRef} className="sticky-title" data-visible={visible}>
      {title}
    </div>
  );
}
