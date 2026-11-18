import { describe, expect, it } from 'vitest'
import { findDominantArtist } from './tracks-utils'

const t = (artist: string) => ({ artist })

describe('findDominantArtist', () => {
  it('returns undefined for an empty list', () => {
    expect(findDominantArtist([])).toBeUndefined()
  })
  it('returns the artist with more than half the tracks', () => {
    expect(findDominantArtist([t('A'), t('A'), t('A'), t('B')])).toBe('A')
  })
  it('requires strictly more than half', () => {
    expect(findDominantArtist([t('A'), t('A'), t('B'), t('B')])).toBeUndefined()
  })
})
