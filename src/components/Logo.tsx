type LogoProps = {
  variant?: 'primary' | 'white' | 'mono-black'
  height?: number
  className?: string
}

const SRC: Record<string, string> = {
  primary: '/brand/drivflo-logo-primary.svg',
  white: '/brand/drivflo-logo-white.svg',
  'mono-black': '/brand/drivflo-logo-mono-black.svg',
}

export default function Logo({ variant = 'primary', height = 24, className = '' }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[variant]}
      alt="Drivflo"
      style={{ height, width: 'auto' }}
      className={className}
    />
  )
}
