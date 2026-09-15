import { describe, expect, it } from 'vitest'
import { shopProducts, catalogKey, buildCatalogLookup } from '../src/lib/shop-catalog'

describe('catalogKey', () => {
  it('joins product, variant and size with double underscore', () => {
    expect(catalogKey('Cappellino CVLT', 'Blu scuro', 'S/M')).toBe('Cappellino CVLT__Blu scuro__S/M')
  })
})

describe('buildCatalogLookup', () => {
  const lookup = buildCatalogLookup()

  it('contains one entry per catalog size', () => {
    const expected = shopProducts.reduce(
      (sum, product) => sum + product.variants.reduce((s, v) => s + v.sizes.length, 0),
      0,
    )
    expect(lookup.size).toBe(expected)
  })

  it('resolves a known combination to its server-authoritative price', () => {
    const entry = lookup.get(catalogKey('Cappellino CVLT', 'Blu scuro', 'S/M'))
    expect(entry).toBeDefined()
    expect(entry?.unitPrice).toBe(15)
    expect(entry?.compareAtPrice).toBe(25)
    expect(entry?.edition).toBe('ed. 2021')
  })

  it('falls back to the product price when the variant has no override', () => {
    const entry = lookup.get(catalogKey('Maglietta 100% Cotone Bio', 'Royal', 'M'))
    expect(entry?.unitPrice).toBe(25)
    expect(entry?.compareAtPrice).toBeUndefined()
  })

  it('returns undefined for an unknown combination', () => {
    expect(lookup.get('Nope__Nope__Nope')).toBeUndefined()
  })

  it('every key round-trips through the lookup', () => {
    for (const product of shopProducts) {
      for (const variant of product.variants) {
        for (const size of variant.sizes) {
          expect(lookup.has(catalogKey(product.name, variant.label, size.size))).toBe(true)
        }
      }
    }
  })
})
