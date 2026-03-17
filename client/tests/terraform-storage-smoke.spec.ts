/**
 * Terraform Smoke Tests — Storage Layer (MemStorage)
 *
 * Tests the real terraformParcel logic via MemStorage.
 * No real DB is touched — fully safe.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Polyfill randomUUID for vitest's browser-like environment
vi.mock('crypto', () => {
  let counter = 0
  return {
    randomUUID: () => `test-uuid-${++counter}`,
  }
})

import { MemStorage } from '../../server/storage/mem'
import type { Player } from '@shared/schema'

let storage: MemStorage
let ownerId: string
let nonOwnerId: string
let ownedPlotId: number

/** Helper: find the first player-owned plot and the owner's ID */
async function findOwnerAndPlot(s: MemStorage) {
  const state = await s.getGameState()
  const owner = state.players.find(p => !p.isAI && p.ownedParcels.length > 0)
  if (!owner) throw new Error('No player with owned parcels found in seed data')
  const plot = state.parcels.find(p => p.ownerId === owner.id)
  if (!plot) throw new Error('No owned plot found')
  return { owner, plot }
}

beforeEach(async () => {
  storage = new MemStorage()
  await (storage as any).initialize()

  const { owner, plot } = await findOwnerAndPlot(storage)
  ownerId = owner.id
  ownedPlotId = plot.plotId

  // Give owner enough FRONTIER balance for tests
  const player = await storage.getPlayer(ownerId)
  if (player) player.frontier = 500

  // Create a non-owner player
  nonOwnerId = 'non-owner-test-id'
  const nonOwner: Player = {
    id: nonOwnerId,
    address: 'NON_OWNER_WALLET',
    name: 'NonOwner',
    iron: 0, fuel: 0, crystal: 0,
    frontier: 500,
    ownedParcels: [],
    isAI: false,
    totalIronMined: 0, totalFuelMined: 0, totalCrystalMined: 0,
    totalFrontierEarned: 0, totalFrontierBurned: 0,
    attacksWon: 0, attacksLost: 0, territoriesCaptured: 0,
    commander: null, commanders: [], activeCommanderIndex: 0,
    specialAttacks: [], drones: [], satellites: [],
    welcomeBonusReceived: false, testnetProgress: [],
  };
  (storage as any).players.set(nonOwnerId, nonOwner)
})

describe('Terraform smoke — storage layer', () => {
  // A1: Owner with enough balance succeeds
  it('succeeds for owner with enough balance (convert_biome)', async () => {
    const result = await storage.terraformParcel(ownedPlotId, ownerId, {
      type: 'convert_biome',
      targetBiome: 'forest',
    })

    expect(result.error).toBeUndefined()
    expect(result.parcel).toBeDefined()
    expect(result.parcel.plotId).toBe(ownedPlotId)
  })

  // A2: Non-owner is rejected
  it('rejects non-owner', async () => {
    const result = await storage.terraformParcel(ownedPlotId, nonOwnerId, {
      type: 'convert_biome',
      targetBiome: 'forest',
    })

    expect(result.error).toContain('do not own')
  })

  // A3: Insufficient balance is rejected
  it('rejects insufficient balance', async () => {
    const player = await storage.getPlayer(ownerId)
    if (player) player.frontier = 1

    const result = await storage.terraformParcel(ownedPlotId, ownerId, {
      type: 'convert_biome',
      targetBiome: 'forest',
    })

    expect(result.error).toContain('Insufficient FRONTIER')
  })

  // A4: Updates biome/hazard/stability correctly
  it('updates biome, hazard, and stability correctly', async () => {
    const state = await storage.getGameState()
    const plotBefore = state.parcels.find(p => p.plotId === ownedPlotId)!
    const stabilityBefore = plotBefore.stability ?? 100

    // Convert biome
    const r1 = await storage.terraformParcel(ownedPlotId, ownerId, {
      type: 'convert_biome',
      targetBiome: 'desert',
    })
    expect(r1.error).toBeUndefined()
    expect(r1.parcel.biome).toBe('desert')
    expect(r1.parcel.stability).toBe(Math.max(0, stabilityBefore - 5))

    // Reduce hazard
    const r2 = await storage.terraformParcel(ownedPlotId, ownerId, {
      type: 'reduce_hazard',
      amount: 10,
    })
    expect(r2.error).toBeUndefined()
    expect(r2.parcel.hazardLevel).toBe(0)

    // Increase stability
    const r3 = await storage.terraformParcel(ownedPlotId, ownerId, {
      type: 'increase_stability',
      amount: 20,
    })
    expect(r3.error).toBeUndefined()
    expect(r3.parcel.stability).toBeLessThanOrEqual(100)
  })

  // A5: Does not deduct balance on invalid transition
  it('does not deduct balance on same-biome conversion', async () => {
    await storage.terraformParcel(ownedPlotId, ownerId, {
      type: 'convert_biome',
      targetBiome: 'desert',
    })

    const playerBefore = await storage.getPlayer(ownerId)
    const balanceBefore = playerBefore!.frontier

    const result = await storage.terraformParcel(ownedPlotId, ownerId, {
      type: 'convert_biome',
      targetBiome: 'desert',
    })

    expect(result.error).toContain('already has that biome')
    const playerAfter = await storage.getPlayer(ownerId)
    expect(playerAfter!.frontier).toBe(balanceBefore)
  })

  // A6: Writes updated state correctly (read-back verification)
  it('persists updated state in storage', async () => {
    await storage.terraformParcel(ownedPlotId, ownerId, {
      type: 'boost_resources',
      amount: 0.5,
    })

    const state = await storage.getGameState()
    const plot = state.parcels.find(p => p.plotId === ownedPlotId)!
    expect(plot.yieldMultiplier).toBeCloseTo(1.5, 3)

    const player = state.players.find(p => p.id === ownerId)!
    expect(player.frontier).toBe(500 - 15)
  })
})
