import { describe, it, expect } from 'vitest'
import { applyTerraform, TerraformState } from '../src/terraforming'

const baseState: TerraformState = {
  biome: 'desert',
  hazardLevel: 50,
  stability: 50,
  resourceMultiplier: 1,
  factionInfluence: null
}

describe('Terraforming system', () => {
  it('converts biome when transition is valid', () => {
    const result = applyTerraform(baseState, {
      type: 'convert_biome',
      targetBiome: 'forest'
    })

    expect(result.success).toBe(true)
    expect(result.state.biome).toBe('forest')
    expect(result.state.stability).toBe(45)
  })

  it('blocks invalid biome transition', () => {
    const icyState: TerraformState = {
      ...baseState,
      biome: 'ice'
    }

    const result = applyTerraform(icyState, {
      type: 'convert_biome',
      targetBiome: 'forest'
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid biome transition')
    expect(result.state.biome).toBe('ice')
  })

  it('reduces hazard safely', () => {
    const result = applyTerraform(baseState, {
      type: 'reduce_hazard',
      amount: 60
    })

    expect(result.success).toBe(true)
    expect(result.state.hazardLevel).toBe(0)
  })

  it('increases stability safely', () => {
    const result = applyTerraform(baseState, {
      type: 'increase_stability',
      amount: 70
    })

    expect(result.success).toBe(true)
    expect(result.state.stability).toBe(100)
  })

  it('boosts resources', () => {
    const result = applyTerraform(baseState, {
      type: 'boost_resources',
      amount: 0.5
    })

    expect(result.success).toBe(true)
    expect(result.state.resourceMultiplier).toBe(1.5)
  })

  it('corrupts land', () => {
    const plainsState: TerraformState = {
      ...baseState,
      biome: 'plains',
      hazardLevel: 20,
      stability: 80
    }

    const result = applyTerraform(plainsState, {
      type: 'corrupt_land',
      amount: 25
    })

    expect(result.success).toBe(true)
    expect(result.state.biome).toBe('toxic')
    expect(result.state.hazardLevel).toBe(45)
    expect(result.state.stability).toBe(55)
  })

  it('rejects invalid starting state', () => {
    const badState: TerraformState = {
      ...baseState,
      hazardLevel: 200
    }

    const result = applyTerraform(badState, {
      type: 'reduce_hazard',
      amount: 10
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('hazardLevel')
  })

  it('does not mutate the original object', () => {
    const original: TerraformState = { ...baseState }

    const result = applyTerraform(original, {
      type: 'increase_stability',
      amount: 10
    })

    expect(original.stability).toBe(50)
    expect(result.state.stability).toBe(60)
  })
})