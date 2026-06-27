import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Only the network boundary is mocked; the store logic (mapping + state
// transitions) runs for real.
vi.mock('@/api/client', () => ({
  default: { getInsights: vi.fn() },
}));

import api from '@/api/client';
import { useInventoryStore } from '@/stores/inventoryStore';

const getInsights = api.getInsights as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  useInventoryStore.getState().clearAll();
});

describe('inventoryStore.loadInsights', () => {
  it('maps endpoint insight objects onto the AIInsight shape', async () => {
    getInsights.mockResolvedValue({
      data: {
        insights: [
          { title: 'Stock Low', insight: 'Cola is low', action: 'Reorder', priority: 'high' },
          { title: 'Hidden Gold', insight: 'Push Bread', action: 'Display it', priority: 'medium' },
        ],
      },
      error: null,
    });

    await useInventoryStore.getState().loadInsights();

    const { insights, insightsLoading, insightsError } = useInventoryStore.getState();
    expect(insightsLoading).toBe(false);
    expect(insightsError).toBeNull();
    expect(insights).toHaveLength(2);
    expect(insights[0]).toMatchObject({
      title: 'Stock Low',
      description: 'Cola is low',
      type: 'warning', // high priority -> warning
      isRead: false,
    });
    expect(insights[0].data).toEqual({ action: 'Reorder', priority: 'high' });
    expect(insights[1].type).toBe('opportunity'); // non-high -> opportunity
  });

  it('surfaces a load error instead of silently swallowing it', async () => {
    getInsights.mockResolvedValue({ data: null, error: 'Insufficient credits' });

    await useInventoryStore.getState().loadInsights();

    const { insights, insightsLoading, insightsError } = useInventoryStore.getState();
    expect(insightsLoading).toBe(false);
    expect(insightsError).toBe('Insufficient credits');
    expect(insights).toHaveLength(0);
  });

  it('handles an empty insight list as a clean empty state', async () => {
    getInsights.mockResolvedValue({ data: { insights: [] }, error: null });

    await useInventoryStore.getState().loadInsights();

    const { insights, insightsError } = useInventoryStore.getState();
    expect(insightsError).toBeNull();
    expect(insights).toHaveLength(0);
  });
});
