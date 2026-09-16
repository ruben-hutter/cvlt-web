'use client'

import { useEffect, useState } from 'react'
import { decodeEmail, emailToHumanForm } from '@/lib/obfuscate'

type ObfuscatedEmailLinkProps = {
  /** base64-encoded address, see src/lib/obfuscate.ts */
  encoded: string
  className?: string
  title?: string
  /** Accessible label, e.g. `Email ${name}` for icon-only links */
  ariaLabel?: string
  /** Visible link text once JS is active; defaults to the address itself */
  label?: string
  children?: React.ReactNode
}

// Renders an email link that never ships the address in plain text:
// - SSR / no JS: a <span> with the "name [at] domain [dot] tld" fallback
// - after hydration: a real <a href="mailto:...">, so clicking opens the
//   mail client, screen readers announce the address and copy-paste works
export function ObfuscatedEmailLink({
  encoded,
  className,
  title,
  ariaLabel,
  label,
  children,
}: ObfuscatedEmailLinkProps) {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    setEmail(decodeEmail(encoded))
  }, [encoded])

  if (email === null) {
    return (
      <span className={className} title={title} aria-label={ariaLabel}>
        {children ?? emailToHumanForm(decodeEmail(encoded))}
      </span>
    )
  }

  return (
    <a href={`mailto:${email}`} className={className} title={title} aria-label={ariaLabel}>
      {children ?? label ?? email}
    </a>
  )
}
