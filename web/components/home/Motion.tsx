"use client";

import { useEffect } from "react";

/** Entrances (once), the hero shutter, and a slow scroll drift on the hero sheet's columns. */
export default function Motion() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    // A fully clipped element never intersects, so a shutter opens when its frame does.
    const shutters = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.querySelector(".shutter")?.classList.add("is-in");
          shutters.unobserve(e.target);
        }
      }
    });
    document.querySelectorAll(".shutter").forEach((el) => el.parentElement && shutters.observe(el.parentElement));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cols = [...document.querySelectorAll<HTMLElement>("[data-drift]")];
    const bar = document.querySelector<HTMLElement>("[data-sitebar]");
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (!reduce) {
          for (const c of cols) c.style.translate = `0 ${-(y * Number(c.dataset.drift))}px`;
        }
        bar?.toggleAttribute("data-shown", y > window.innerHeight * 0.85);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      shutters.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
