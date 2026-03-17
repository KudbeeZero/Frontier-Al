import { applyTerraform, Biome, TerraformState } from './terraforming'

export type Player = {
  id: string
  balance: number
}

export type Parcel = {
  id: string
  ownerId: string
  terraformState: TerraformState
}

export type TerraformPayAction =
  | { type: 'random' }
  | { type: 'targeted'; biome: Biome }

export type PayAndTerraformResult = {
  success: boolean
  player: Player
  parcel: Parcel
  error?: string
}

const BIOMES: Biome[] = ['desert', 'forest', 'ice', 'toxic', 'plains']

export const terraformCosts = {
  random: 10,
  targeted: {
    desert: 20,
    forest: 25,
    ice: 30,
    toxic: 15,
    plains: 18
  }
}

export function canAfford(player: Player, cost: number): boolean {
  return player.balance >= cost
}

export function deductBalance(player: Player, cost: number): Player {
  return { ...player, balance: player.balance - cost }
}

export function getRandomBiome(currentBiome: Biome): Biome {
  const options = BIOMES.filter((b) => b !== currentBiome)
  const index = Math.floor(Math.random() * options.length)
  return options[index]
}

export function canTerraformParcel(player: Player, parcel: Parcel): boolean {
  return player.id === parcel.ownerId
}

export function payAndTerraform(
  player: Player,
  parcel: Parcel,
  action: TerraformPayAction
): PayAndTerraformResult {
  if (!canTerraformParcel(player, parcel)) {
    return {
      success: false,
      player,
      parcel,
      error: `Player ${player.id} does not own parcel ${parcel.id}`
    }
  }

  const cost =
    action.type === 'random'
      ? terraformCosts.random
      : terraformCosts.targeted[action.biome]

  if (!canAfford(player, cost)) {
    return {
      success: false,
      player,
      parcel,
      error: `Insufficient balance. Need ${cost}, have ${player.balance}`
    }
  }

  const updatedPlayer = deductBalance(player, cost)

  const targetBiome =
    action.type === 'random'
      ? getRandomBiome(parcel.terraformState.biome)
      : action.biome

  const terraformResult = applyTerraform(parcel.terraformState, {
    type: 'convert_biome',
    targetBiome
  })

  if (!terraformResult.success) {
    return {
      success: false,
      player,
      parcel,
      error: terraformResult.error
    }
  }

  const updatedParcel: Parcel = {
    ...parcel,
    terraformState: terraformResult.state
  }

  return {
    success: true,
    player: updatedPlayer,
    parcel: updatedParcel
  }
}

// ── Real API integration ──────────────────────────────────────────────────────

export type ApiTerraformAction =
  | { type: 'convert_biome'; targetBiome: string }
  | { type: 'reduce_hazard'; amount: number }
  | { type: 'increase_stability'; amount: number }
  | { type: 'boost_resources'; amount: number }
  | { type: 'corrupt_land'; amount: number }

export type ApiTerraformResult = {
  success: boolean
  parcel?: unknown
  error?: string
}

/**
 * Send a terraform action to the real server API.
 * The server validates ownership, deducts FRONTIER, and persists the changes.
 *
 * @param plotId  Integer plot ID (1–21000)
 * @param playerId  Player UUID
 * @param action  Terraform action to apply
 */
export async function terraformPlot(
  plotId: number,
  playerId: string,
  action: ApiTerraformAction
): Promise<ApiTerraformResult> {
  try {
    const res = await fetch(`/api/plots/${plotId}/terraform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, action })
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error ?? 'Server error' }
    return { success: true, parcel: data.parcel }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
