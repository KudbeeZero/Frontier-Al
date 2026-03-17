  export type Biome = 'desert' | 'forest' | 'ice' | 'toxic' | 'plains'

  export type TerraformAction =
    | { type: 'convert_biome'; targetBiome: Biome }
    | { type: 'reduce_hazard'; amount: number }
    | { type: 'increase_stability'; amount: number }
    | { type: 'boost_resources'; amount: number }
    | { type: 'corrupt_land'; amount: number }

  export type TerraformState = {
    biome: Biome
    hazardLevel: number
    stability: number
    resourceMultiplier: number
    factionInfluence: string | null
    /** Lifecycle status: 'none' = pristine, 'active' = terraformed, 'degraded' = high hazard/low stability */
    terraformStatus: 'none' | 'active' | 'degraded'
    /** Unix ms timestamp of last terraform action (null = never terraformed) */
    terraformedAt: number | null
    /** Cumulative count of terraform actions applied */
    terraformLevel: number
    /** Action type of the most recent terraform operation */
    terraformType: string | null
    /** Monotonic counter incremented on every state change; used to detect metadata updates */
    metadataVersion: number
    /** Monotonic counter incremented on biome/visual changes; triggers render refresh */
    visualStateRevision: number
  }

  export type TerraformResult = {
    success: boolean
    state: TerraformState
    error?: string
  }

  function clamp(value: number, min = 0, max = 100): number {
    return Math.max(min, Math.min(max, value))
  }

  function isValidBiomeTransition(current: Biome, target: Biome): boolean {
    if (current === target) return false
    if (current === 'ice' && target === 'forest') return false
    if (current === 'toxic' && target === 'forest') return false
    return true
  }

  function validateState(state: TerraformState): string | null {
    if (state.hazardLevel < 0 || state.hazardLevel > 100) {
      return 'hazardLevel must be between 0 and 100'
    }

    if (state.stability < 0 || state.stability > 100) {
      return 'stability must be between 0 and 100'
    }

    if (state.resourceMultiplier < 0) {
      return 'resourceMultiplier cannot be negative'
    }

    return null
  }

  export function applyTerraform(
    state: TerraformState,
    action: TerraformAction
  ): TerraformResult {
    const validationError = validateState(state)
    if (validationError) {
      return {
        success: false,
        state,
        error: validationError
      }
    }

    let nextState: TerraformState = { ...state }

    switch (action.type) {
      case 'convert_biome': {
        if (!isValidBiomeTransition(state.biome, action.targetBiome)) {
          return {
            success: false,
            state,
            error: `Invalid biome transition from ${state.biome} to ${action.targetBiome}`
          }
        }

        nextState.biome = action.targetBiome
        nextState.stability = clamp(nextState.stability - 5)
        break
      }

      case 'reduce_hazard': {
        if (action.amount <= 0) {
          return {
            success: false,
            state,
            error: 'reduce_hazard amount must be greater than 0'
          }
        }

        nextState.hazardLevel = clamp(nextState.hazardLevel - action.amount)
        break
      }

      case 'increase_stability': {
        if (action.amount <= 0) {
          return {
            success: false,
            state,
            error: 'increase_stability amount must be greater than 0'
          }
        }

        nextState.stability = clamp(nextState.stability + action.amount)
        break
      }

      case 'boost_resources': {
        if (action.amount <= 0) {
          return {
            success: false,
            state,
            error: 'boost_resources amount must be greater than 0'
          }
        }

        nextState.resourceMultiplier = Number(
          (nextState.resourceMultiplier + action.amount).toFixed(2)
        )
        break
      }

      case 'corrupt_land': {
        if (action.amount <= 0) {
          return {
            success: false,
            state,
            error: 'corrupt_land amount must be greater than 0'
          }
        }

        nextState.hazardLevel = clamp(nextState.hazardLevel + action.amount)
        nextState.stability = clamp(nextState.stability - action.amount)
        if (nextState.biome === 'plains') {
          nextState.biome = 'toxic'
        }
        break
      }

      default: {
        return {
          success: false,
          state,
          error: 'Unknown terraform action'
        }
      }
    }

    // Update terraform tracking fields.
    const isVisualChange = action.type === 'convert_biome' ||
      (action.type === 'corrupt_land' && state.biome === 'plains')
    const newStatus: 'none' | 'active' | 'degraded' =
      nextState.hazardLevel > 60 || nextState.stability < 30 ? 'degraded' : 'active'

    nextState.terraformStatus     = newStatus
    nextState.terraformedAt       = Date.now()
    nextState.terraformLevel      = (state.terraformLevel ?? 0) + 1
    nextState.terraformType       = action.type
    nextState.metadataVersion     = (state.metadataVersion ?? 1) + 1
    nextState.visualStateRevision = isVisualChange
      ? (state.visualStateRevision ?? 0) + 1
      : (state.visualStateRevision ?? 0)

    return {
      success: true,
      state: nextState
    }
  }

