import Image from 'next/image'
import Link from 'next/link'

interface LogoProps {
  href?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function Logo({ href = '/', size = 'md' }: LogoProps) {
  const heights: Record<string, number> = { sm: 28, md: 36, lg: 48 }
  const h = heights[size]
  const w = Math.round(h * 3.2) // maintain aspect ratio

  const inner = (
    <span className="group inline-flex items-center gap-2.5 cursor-pointer select-none">
      <span className="relative overflow-hidden rounded-md transition-all duration-300 group-hover:shadow-lg group-hover:shadow-brand-indigo/30 group-hover:scale-105">
        <Image
          src="/logo.png"
          alt="Webtek.ai"
          width={w}
          height={h}
          className="object-contain transition-all duration-300 group-hover:brightness-110"
          priority
        />
      </span>
    </span>
  )

  if (!href) return inner

  return (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  )
}
