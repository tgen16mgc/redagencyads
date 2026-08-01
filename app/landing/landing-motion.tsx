"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollToPlugin } from "gsap/ScrollToPlugin"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useRef, type ReactNode } from "react"

import styles from "./landing.module.css"

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollToPlugin)

export function LandingMotion({ children }: { children: ReactNode }) {
  const pageRef = useRef<HTMLElement>(null)

  useGSAP(
    (_, contextSafe) => {
      const page = pageRef.current
      if (!page) return

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (reduceMotion) return

      gsap.from(page.querySelectorAll<HTMLElement>("[data-gsap-hero]"), {
        autoAlpha: 0,
        y: 24,
        filter: "blur(8px)",
        duration: 0.85,
        stagger: 0.1,
        ease: "power3.out",
        clearProps: "filter,opacity,transform,visibility",
      })

      page.querySelectorAll<HTMLElement>("[data-gsap-reveal]").forEach((element) => {
        gsap.from(element, {
          y: 34,
          scale: 0.985,
          duration: 0.8,
          ease: "power3.out",
          clearProps: "transform",
          scrollTrigger: {
            trigger: element,
            start: "top 88%",
            once: true,
          },
        })
      })

      const scrollToAnchor = (event: MouseEvent) => {
        const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]')
        if (!anchor) return

        const target = page.querySelector<HTMLElement>(anchor.hash)
        if (!target) return

        event.preventDefault()
        gsap.to(window, {
          duration: 0.9,
          ease: "power3.inOut",
          scrollTo: { y: target, offsetY: 88 },
          onComplete: () => window.history.replaceState(null, "", anchor.hash),
        })
      }
      const handleAnchorClick = contextSafe ? contextSafe(scrollToAnchor) : scrollToAnchor

      page.addEventListener("click", handleAnchorClick)
      return () => page.removeEventListener("click", handleAnchorClick)
    },
    { scope: pageRef },
  )

  return (
    <main ref={pageRef} className={styles.page}>
      {children}
    </main>
  )
}
