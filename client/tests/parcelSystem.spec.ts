import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { payAndTerraform, canAfford, canTerraformParcel, Player, Parcel, terraformCosts } from '../src/parcelSystem'

const makePlayer = (balance: number, id = 'player-1'): Player => ({
  id,
  balance
})

const makeParcel = (ownerId = 'player-1'): Parcel => ({
  id: 'parcel-1',
  ownerId,
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

  it('owner can terraform with random action', () => {
    const player = makePlayer(50)
    const parcel = makeParcel('player-1')

    const result = payAndTerraform(player, parcel, { type: 'random' })

    expect(result.success).toBe(true)
    expect(result.player.balance).toBe(50 - terraformCosts.random)
  })

  it('owner can terraform with targeted action', () => {
    const player = makePlayer(50)
    const parcel = makeParcel('player-1')

    const result = payAndTerraform(player, parcel, { type: 'targeted', biome: 'plains' })

    expect(result.success).toBe(true)
    expect(result.player.balance).toBe(50 - terraformCosts.targeted.plains)
    expect(result.parcel.terraformState.biome).toBe('plains')
  })

  it('non-owner cannot terraform', () => {
    const player = makePlayer(100, 'player-2')
    const parcel = makeParcel('player-1')

    const result = payAndTerraform(player, parcel, { type: 'random' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('does not own parcel')
  })

  it('non-owner does not lose balance', () => {
    const player = makePlayer(100, 'player-2')
    const parcel = makeParcel('player-1')

    const result = payAndTerraform(player, parcel, { type: 'targeted', biome: 'plains' })

    expect(result.success).toBe(false)
    expect(result.player.balance).toBe(100)
  })

  it('non-owner parcel does not change', () => {
    const player = makePlayer(100, 'player-2')
    const parcel = makeParcel('player-1')
    const originalBiome = parcel.terraformState.biome

    const result = payAndTerraform(player, parcel, { type: 'targeted', biome: 'plains' })

    expect(result.success).toBe(false)
    expect(result.parcel.terraformState.biome).toBe(originalBiome)
  })

  it('canTerraformParcel returns true for owner', () => {
    const player = makePlayer(100)
    const parcel = makeParcel('player-1')
    expect(canTerraformParcel(player, parcel)).toBe(true)
  })

  it('canTerraformParcel returns false for non-owner', () => {
    const player = makePlayer(100, 'player-2')
    const parcel = makeParcel('player-1')
    expect(canTerraformParcel(player, parcel)).toBe(false)
  })

  it('owner with low balance still fails correctly', () => {
    const player = makePlayer(2)
    const parcel = makeParcel('player-1')

    const result = payAndTerraform(player, parcel, { type: 'random' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Insufficient balance')
    expect(result.player.balance).toBe(2)
  })

  it('parcel biome changes after owner terraform', () => {
    const player = makePlayer(100)
    const parcel = makeParcel('player-1')

    const result = payAndTerraform(player, parcel, { type: 'targeted', biome: 'plains' })

    expect(result.success).toBe(true)
    expect(result.parcel.terraformState.biome).toBe('plains')
  })

  it('original player is not mutated', () => {
    const player = makePlayer(100)
    const originalBalance = player.balance
    const parcel = makeParcel('player-1')

    payAndTerraform(player, parcel, { type: 'random' })

    expect(player.balance).toBe(originalBalance)
  })

  it('original parcel is not mutated', () => {
    const player = makePlayer(100)
    const parcel = makeParcel('player-1')
    const originalBiome = parcel.terraformState.biome

    payAndTerraform(player, parcel, { type: 'targeted', biome: 'plains' })

    expect(parcel.terraformState.biome).toBe(originalBiome)
  })

  it('does not deduct balance when terraform transition is invalid', () => {
    const player = makePlayer(100)
    const parcel: Parcel = {
      id: 'parcel-2',
      ownerId: 'player-1',
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
