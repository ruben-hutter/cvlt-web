export type NavSubLink = {
  href: string
  label: string
}

export const VENTO_SECTION_IDS = [
  'stazioni',
  'pressione',
  'laghi',
  'radiosondaggi',
] as const

export const VENTO_PRESSURE_SECTION_IDS = ['pressione'] as const

export const VENTO_SUB_LINKS = [
  { href: '/vento#stazioni', label: 'Stazioni' },
  { href: '/vento#pressione', label: 'Pressione' },
  { href: '/vento#laghi', label: 'Laghi' },
  { href: '/vento#radiosondaggi', label: 'Radiosondaggi' },
] as const satisfies readonly NavSubLink[]

export const GARE_SUB_LINKS = [
  { href: '/gare#ccc', label: 'CCC' },
  { href: '/gare#hike-and-fly', label: 'Hike & Fly' },
  { href: '/gare#regio-sud', label: 'Regio Sud' },
] as const satisfies readonly NavSubLink[]

/**
 * Document file types accepted as media uploads and news attachments.
 *
 * Payload content-sniffs every upload, so each entry must survive detection:
 * - Office Open XML (.docx/.xlsx/.pptx) and ODF (.odt/.ods/.odp) are detected
 *   from their zip structure; some generators produce zips that only detect as
 *   generic `application/zip`, so that must stay in the list as a fallback.
 * - Plain text files (.txt/.csv) have no magic bytes: detection fails and
 *   Payload falls back to the file extension (`text/plain`, `text/csv`).
 * - Legacy Office formats (.doc/.xls/.ppt) are deliberately NOT supported:
 *   they detect as `application/x-cfb`, which would also allow .msi installers.
 */
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.oasis.opendocument.text', // .odt
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'application/vnd.oasis.opendocument.presentation', // .odp
  'application/zip',
  'text/plain',
  'text/csv',
] as const

export const INFO_VOLO_SUB_LINKS = [
  { href: '/info-volo#spazio-aereo', label: 'Spazio aereo' },
  { href: '/info-volo#meteo-vento', label: 'Meteo & Vento' },
  { href: '/info-volo#link-meteo', label: 'Link meteo' },
  { href: '/info-volo#webcam', label: 'Webcam' },
  { href: '/info-volo#link-utili', label: 'Link utili' },
] as const satisfies readonly NavSubLink[]
