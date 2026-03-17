// src/terraforming.ts

export type Biome = 'desert' | 'forest' | 'ice'

export type TerraformState = {
  biome: Biome
}

export function convertBiome(
  state: TerraformState,
  target: Biome
): TerraformState {
  // simple rule: ice cannot become forest (just for testing logic)
  if (state.biome === 'ice' && target === 'forest') {
    throw new Error('Invalid biome conversion')
  }

  return {
    ...state,
    biome: target
  }
}