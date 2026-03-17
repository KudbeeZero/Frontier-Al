import { applyTerraform, Biome, TerraformState } from './terraforming'

export type Player = {
  id: string
  balance: number
}

export type Parcel = {
  id: string
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

export function payAndTerraform(
  player: Player,
  parcel: Parcel,
  action: TerraformPayAction
): PayAndTerraformResult {
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
