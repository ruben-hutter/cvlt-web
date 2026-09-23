import type { Block, CollectionConfig, FieldHook } from 'payload'
import { isLoggedIn } from './Users'
import { titleToSlug, deduplicateSlug } from '../lib/slug'
import { DOCUMENT_MIME_TYPES } from '../lib/constants'

const formatSlug: FieldHook = async ({ data, originalDoc, operation, req }) => {
  if (!data?.title) return undefined

  if (operation === 'update' && originalDoc?.slug && originalDoc?.title === data.title) {
    return originalDoc.slug
  }

  const baseSlug = titleToSlug(data.title)
  if (!req.payload) return baseSlug
  return deduplicateSlug(req.payload, 'news', baseSlug, data.id ?? originalDoc?.id)
}



// --- Layout Blocks ---

const RichTextBlock: Block = {
  slug: 'richText',
  labels: { singular: 'Testo', plural: 'Testi' },
  admin: { disableBlockName: true },
  fields: [
    {
      name: 'content',
      type: 'richText',
      label: ' ',
      required: true,
    },
  ],
}

const ImageBlock: Block = {
  slug: 'image',
  labels: { singular: 'Immagine', plural: 'Immagini' },
  admin: { disableBlockName: true },
  fields: [
    {
      name: 'image',
      type: 'upload',
      label: 'Immagine',
      relationTo: 'media',
      required: true,
      filterOptions: { mimeType: { contains: 'image/' } },
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Didascalia',
    },
    {
      name: 'size',
      type: 'select',
      label: 'Dimensione',
      defaultValue: 'full',
      options: [
        { label: 'Piccola', value: 'small' },
        { label: 'Media', value: 'medium' },
        { label: 'Grande', value: 'large' },
        { label: 'Intera larghezza', value: 'full' },
      ],
    },
  ],
}

const TextImageBlock: Block = {
  slug: 'textImage',
  labels: { singular: 'Testo + Immagine', plural: 'Testo + Immagine' },
  admin: { disableBlockName: true },
  fields: [
    {
      name: 'layout',
      type: 'select',
      label: 'Disposizione',
      defaultValue: 'imageRight',
      options: [
        { label: 'Immagine a destra', value: 'imageRight' },
        { label: 'Immagine a sinistra', value: 'imageLeft' },
      ],
    },
    {
      name: 'text',
      type: 'richText',
      label: 'Testo',
      required: true,
    },
    {
      name: 'image',
      type: 'upload',
      label: 'Immagine',
      relationTo: 'media',
      required: true,
      filterOptions: { mimeType: { contains: 'image/' } },
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Didascalia',
    },
  ],
}

const GalleryBlock: Block = {
  slug: 'gallery',
  labels: { singular: 'Galleria', plural: 'Gallerie' },
  admin: { disableBlockName: true },
  fields: [
    {
      name: 'columns',
      type: 'select',
      label: 'Colonne',
      defaultValue: '3',
      options: [
        { label: '2 colonne', value: '2' },
        { label: '3 colonne', value: '3' },
        { label: '4 colonne', value: '4' },
      ],
    },
    {
      name: 'images',
      type: 'array',
      label: 'Immagini',
      minRows: 1,
      fields: [
        {
          name: 'image',
          type: 'upload',
          label: 'Immagine',
          relationTo: 'media',
          required: true,
          filterOptions: { mimeType: { contains: 'image/' } },
        },
        {
          name: 'caption',
          type: 'text',
          label: 'Didascalia',
        },
      ],
    },
  ],
}

const AttachmentBlock: Block = {
  slug: 'attachment',
  labels: { singular: 'Allegato', plural: 'Allegati' },
  admin: { disableBlockName: true },
  fields: [
    {
      name: 'file',
      type: 'upload',
      label: 'File',
      relationTo: 'media',
      required: true,
      filterOptions: { mimeType: { in: [...DOCUMENT_MIME_TYPES] } },
    },
    {
      name: 'label',
      type: 'text',
      label: 'Etichetta',
      admin: {
        description: 'Testo visualizzato per il link. Se vuoto, verrà usato il nome del file.',
      },
    },
  ],
}

// --- Collection ---

export const News: CollectionConfig = {
  slug: 'news',
  labels: { singular: 'Notizia', plural: 'Notizie' },
  lockDocuments: false,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishDate', 'status'],
    preview: (doc) => `/notizie/preview/${doc.id}`,
  },
  access: {
    read: () => true,
    create: isLoggedIn,
    update: isLoggedIn,
    delete: isLoggedIn,
  },
  custom: {
    totp: { disableAccessWrapper: { read: true } },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Titolo',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      hooks: {
        beforeValidate: [formatSlug],
      },
      admin: {
        hidden: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Stato',
      defaultValue: 'draft',
      options: [
        { label: 'Bozza', value: 'draft' },
        { label: 'Pubblicato', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'relatedEvent',
      type: 'relationship',
      relationTo: 'events',
      label: 'Evento collegato',
      admin: {
        position: 'sidebar',
        description: 'Collega questa notizia a un evento del calendario.',
      },
    },
    {
      name: 'tag',
      type: 'select',
      label: 'Tag',
      options: [{ label: 'In primo piano', value: 'featured' }],
      admin: {
        position: 'sidebar',
        description: 'Usa "In primo piano" per dare priorita alla notizia nelle liste.',
      },
    },
    {
      name: 'publishDate',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      label: 'Data di pubblicazione',
      hooks: {
        beforeValidate: [
          ({ value }) => {
            // If cleared, reset to today
            if (!value) return new Date().toISOString()
            return value
          },
        ],
      },
      admin: {
        position: 'sidebar',
        description: 'La notizia sarà visibile a partire da questa data. Predefinito: oggi.',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'dd/MM/yyyy',
        },
      },
    },
    {
      name: 'thumbnail',
      type: 'upload',
      label: 'Miniatura',
      relationTo: 'media',
      filterOptions: { mimeType: { contains: 'image/' } },
    },
    {
      name: 'layout',
      type: 'blocks',
      label: 'Contenuto',
      required: true,
      blocks: [RichTextBlock, ImageBlock, TextImageBlock, GalleryBlock, AttachmentBlock],
    },
    {
      name: 'author',
      type: 'relationship',
      label: 'Autore',
      relationTo: 'users',
      hooks: {
        beforeChange: [
          ({ req, value, operation }) => {
            if (operation === 'create' && req.user) return req.user.id
            if (req.user?.role !== 'admin' && req.user) return req.user.id
            return value
          },
        ],
      },
      admin: {
        position: 'sidebar',
        condition: (_data, _siblingData, { user }) => user?.role === 'admin',
      },
    },
  ],
}
