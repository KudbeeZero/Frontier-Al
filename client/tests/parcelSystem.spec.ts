import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { payAndTerraform, canAfford, Player, Parcel, terraformCosts } from '../src/parcelSystem'

const makePlayer = (balance: number): Player => ({
  id: 'player-1',
  balance
})

const makeParcel = (): Parcel => ({
  id: 'parcel-1',
  terraformState: {
    biome: 'desert',
    hazardLevel: 30,
    stability: 60,
    resourceMultiplier: 1,
    factionInfluence: null
  }
})

describe('Parcel terraform payment system', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('player can afford random terraform', () => {
    const player = makePlayer(100)
    expect(canAfford(player, terraformCosts.random)).toBe(true)
  })

  it('player cannot afford targeted terraform', () => {
    const player = makePlayer(5)
    expect(canAfford(player, terraformCosts.targeted.ice)).toBe(false)
  })

  it('random terraform deducts balance', () => {
    const player = makePlayer(50)
    const parcel = makeParcel()

    const result = payAndTerraform(player, parcel, { type: 'random' })

    expect(result.success).toBe(true)
    expect(result.player.balance).toBe(50 - terraformCosts.random)
  })

  it('targeted terraform deducts balance', () => {
    const player = makePlayer(50)
    const parcel = makeParcel()

    const result = payAndTerraform(player, parcel, { type: 'targeted', biome: 'plains' })

    expect(result.success).toBe(true)
    expect(result.player.balance).toBe(50 - terraformCosts.targeted.plains)
  })

  it('parcel biome changes after terraform', () => {
    const player = makePlayer(100)
    const parcel = makeParcel()

    const result = payAndTerraform(player, parcel, { type: 'targeted', biome: 'plains' })

    expect(result.success).toBe(true)
    expect(result.parcel.terraformState.biome).toBe('plains')
  })

  it('original player is not mutated', () => {
    const player = makePlayer(100)
    const originalBalance = player.balance
    const parcel = makeParcel()

    payAndTerraform(player, parcel, { type: 'random' })

    expect(player.balance).toBe(originalBalance)
  })

  it('original parcel is not mutated', () => {
    const player = makePlayer(100)
    const parcel = makeParcel()
    const originalBiome = parcel.terraformState.biome

    payAndTerraform(player, parcel, { type: 'targeted', biome: 'plains' })

    expect(parcel.terraformState.biome).toBe(originalBiome)
  })

  it('returns error when player cannot afford', () => {
    const player = makePlayer(2)
    const parcel = makeParcel()

    const result = payAndTerraform(player, parcel, { type: 'random' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Insufficient balance')
    expect(result.player.balance).toBe(2)
  })

  it('does not deduct balance when terraform transition is invalid', () => {
    const player = makePlayer(100)
    const parcel: Parcel = {
      id: 'parcel-2',
      terraformState: {
        biome: 'ice',
        hazardLevel: 30,
        stability: 60,
        resourceMultiplier: 1,
        factionInfluence: null
      }
    }

    const result = payAndTerraform(player, parcel, { type: 'targeted', biome: 'forest' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid biome transition')
    expect(result.player.balance).toBe(100)
    expect(result.parcel.terraformState.biome).toBe('ice')
  })
})
