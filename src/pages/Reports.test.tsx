import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReportTotals, SalesReport } from '@/api/client';
const mocks = vi.hoisted(() => ({
  getSalesReport: vi.fn(),
  getProductReport: vi.fn(),
  getStaffReport: vi.fn(),
  downloadCsv: vi.fn(),
}));
vi.mock('@/api/client', () => ({ default: mocks }));
vi.mock('@/lib/exportReport', () => ({
  downloadCsv: mocks.downloadCsv,
  reportFilename: () => 'report.csv',
}));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ shop }) }));
import { Reports } from './Reports';
const shop = { id: 'shop-1', name: 'Test shop' };
const totals: ReportTotals = {
  grossSales: 230,
  returns: 115,
  exchangeSales: 57.5,
  totalSales: 172.5,
  salesTax: 30,
  returnedTax: 15,
  exchangeTax: 7.5,
  totalTax: 22.5,
  grossCost: 80,
  reversedCost: 40,
  exchangeCost: 20,
  totalCost: 60,
  netRevenue: 150,
  grossProfit: 90,
};
const evidence = {
  receiptlessReturns: 10,
  receiptlessCount: 1,
  unvaluedExchange: 20,
  unvaluedExchangeCount: 1,
};
const report: SalesReport = {
  summary: {
    ...totals,
    ...evidence,
    profitComplete: false,
    totalExpenses: 5,
    netProfit: 85,
    totalTransactions: 1,
    averageBasket: 230,
  },
  topProducts: [],
  stock: { stockValue: 300, lowStockCount: 0, totalProducts: 1 },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSalesReport.mockResolvedValue({ data: report });
  mocks.getProductReport.mockResolvedValue({
    data: {
      products: [
        {
          ...totals,
          id: 'p',
          name: 'Rice',
          category: 'Food',
          quantitySold: 1,
          revenue: 150,
          cost: 60,
          profit: 90,
          margin: 60,
          averagePrice: 230,
        },
      ],
      categories: [],
      adjustments: evidence,
    },
  });
  mocks.getStaffReport.mockResolvedValue({
    data: {
      staff: [
        {
          ...totals,
          id: 'u',
          name: 'Cashier',
          role: 'CASHIER',
          transactionCount: 1,
          averageTransaction: 230,
          voidCount: 0,
        },
      ],
      adjustments: evidence,
    },
  });
});
it('reconciles returns and unknown evidence on screen, CSV and printable PDF', async () => {
  const { container } = render(<Reports />);
  await screen.findByText('Sales and return reconciliation');
  expect(screen.getAllByText(/Profit is incomplete/).length).toBe(2);
  const print = within(container.querySelector('#report-print') as HTMLElement);
  expect(print.getByText('Returns (incl. VAT)').parentElement).toHaveTextContent('115.00');
  expect(print.getByText('Net sales (incl. VAT)').parentElement).toHaveTextContent('172.50');
  expect(print.getByText('Restocked COGS reversed').parentElement).toHaveTextContent('40.00');
  fireEvent.click(screen.getByRole('button', { name: /CSV/i }));
  const rows = mocks.downloadCsv.mock.calls[0][2];
  expect(rows).toContainEqual(['Returns (incl. VAT)', '115.00']);
  expect(rows).toContainEqual(['Net revenue (excl. VAT)', '150.00']);
  expect(rows).toContainEqual(['Profit complete', 'No']);
});
it.each(['Products', 'Staff'])('exports the %s tab using the same reconciliation columns as print', async (tab) => {
  const { container } = render(<Reports />);
  await screen.findByText('Sales and return reconciliation');
  fireEvent.click(
    screen.getByRole('button', {
      name: tab === 'Staff' ? 'staff.title' : /· Products/,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /CSV/i }));
  const headers = mocks.downloadCsv.mock.calls[0][1];
  expect(headers).toContain('Gross sales (incl. VAT)');
  expect(headers).toContain('Returns (incl. VAT)');
  expect(headers).toContain('Exchange out (incl. VAT)');
  const print = within(container.querySelector('#report-print') as HTMLElement);
  expect(print.getByText('Returns (incl. VAT)')).toBeInTheDocument();
  expect(print.getByText(/Profit is incomplete/)).toBeInTheDocument();
});
it('surfaces report failure without substituting cached sale-only profit', async () => {
  mocks.getSalesReport.mockResolvedValue({ error: 'Network unavailable' });
  render(<Reports />);
  expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Sales and return reconciliation')).not.toBeInTheDocument();
});
