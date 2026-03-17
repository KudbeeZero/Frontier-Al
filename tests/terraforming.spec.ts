// tests/terraforming.spec.ts

import { describe, it, expect } from 'vitest'
import { convertBiome } from '../src/terraforming'

describe('Terraforming basic test', () => {
  it('should convert desert to forest', () => {
    const result = convertBiome({ biome: 'desert' }, 'forest')
    expect(result.biome).toBe('forest')
  })

  it('should block invalid conversion', () => {
    expect(() =>
      convertBiome({ biome: 'ice' }, 'forest')
    ).toThrow()
  })
})