// Email obfuscation for publicly rendered contact links.
//
// Addresses are stored base64-encoded so that neither the delivered HTML nor
// the client JS bundle contains a plain name@domain token for harvesting bots
// to scrape (unlike rot13, base64 also removes the "@" and "." structure, so
// even naive regex harvesters find nothing email-shaped). The browser
// decodes the address at runtime to build the mailto: link; the server-side
// fallback only ever renders a human-readable obfuscated form.
//
// To add or change a public address, compute its encoded form with:
//   Buffer.from('name@example.ch').toString('base64')  // Node
//   btoa('name@example.ch')                            // browser console

export function decodeEmail(encoded: string): string {
  // atob exists in all browsers and in Node >= 16; Buffer covers other runtimes.
  if (typeof atob === 'function') return atob(encoded)
  return Buffer.from(encoded, 'base64').toString('utf8')
}

// Human-readable form for the no-JS fallback: "info [at] cvlt [dot] ch"
export function emailToHumanForm(email: string): string {
  const [local, ...rest] = email.split('@')
  const domain = rest.join('@')
  return `${local} [at] ${domain.replace(/\./g, ' [dot] ')}`
}

// Club contact address (info@cvlt.ch), encoded — see file header.
export const CLUB_EMAIL_ENCODED = 'aW5mb0Bjdmx0LmNo'
