/**
 * Terraform Smoke Tests — Client Helper
 *
 * Tests the terraformPlot() fetch helper with mocked fetch.
 * Verifies success/error handling matches API contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { terraformPlot } from '../src/parcelSystem'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Terraform smoke — client helper', () => {
  // C11a: terraformPlot calls API and returns success
  it('returns success with parcel data on 200', async () => {
    const mockParcel = { plotId: 1, biome: 'forest', hazardLevel: 0, stability: 95 }
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, parcel: mockParcel }),
    })

    const result = await terraformPlot(1, 'player-1', {
      type: 'convert_biome',
      targetBiome: 'forest',
    })

    expect(result.success).toBe(true)
    expect(result.parcel).toEqual(mockParcel)

    // Verify correct URL and method
    expect(fetch).toHaveBeenCalledWith('/api/plots/1/terraform', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
  })

  // C11b: terraformPlot handles error response
  it('returns error on non-ok response', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'You do not own this plot' }),
    })

    const result = await terraformPlot(1, 'player-2', {
      type: 'convert_biome',
      targetBiome: 'forest',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('You do not own this plot')
  })

  // C11c: terraformPlot handles network error
  it('returns error on network failure', async () => {
    ;(fetch as any).mockRejectedValue(new Error('Network error'))

    const result = await terraformPlot(1, 'player-1', {
      type: 'reduce_hazard',
      amount: 10,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })
})
