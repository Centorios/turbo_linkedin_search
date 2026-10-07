import Image from "next/image";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/cv8-logo-42.png"
      alt="CV8"
      width={64}
      height={64}
      className={className}
      data-testid="brand-logo"
      // Vercel Services serves this asset directly; /_next/image returns 404.
      unoptimized
      priority
    />
  );
}
