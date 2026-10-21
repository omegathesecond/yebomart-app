import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Mock the network boundary so the upload flow can be exercised without a
// real API. Mirrors the vi.mock('@/api/client', ...) pattern used in
// src/pages/AuditLog.test.tsx.
vi.mock('@/api/client', () => ({
  api: {
    getSuppliers: vi.fn(),
    getProductSuppliers: vi.fn(),
    setProductSuppliers: vi.fn(),
    uploadImage: vi.fn(),
  },
}));

const mockAuthState = {
  shop: { id: 'shop-1', businessType: 'general' },
};
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

const addProduct = vi.fn();
const updateProduct = vi.fn();
let mockProducts: Record<string, unknown>[] = [];
vi.mock('@/stores/inventoryStore', () => ({
  useInventoryStore: () => ({
    addProduct,
    updateProduct,
    products: mockProducts,
  }),
}));

let mockParams: { id?: string } = {};
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => mockParams,
}));

import { api } from '@/api/client';
import { ProductForm } from '@/pages/ProductForm';

const getSuppliers = api.getSuppliers as unknown as Mock;
const getProductSuppliers = api.getProductSuppliers as unknown as Mock;
const uploadImage = api.uploadImage as unknown as Mock;

// jsdom doesn't implement createObjectURL/revokeObjectURL.
beforeEach(() => {
  vi.clearAllMocks();
  mockParams = {};
  mockProducts = [];
  getSuppliers.mockResolvedValue({ data: [] });
  getProductSuppliers.mockResolvedValue({ data: [] });
  addProduct.mockResolvedValue('new-product-id');
  URL.createObjectURL = vi.fn(() => 'blob:preview-url');
  URL.revokeObjectURL = vi.fn();
});

function selectFile(input: HTMLElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

const makeFile = () => new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });

describe('ProductForm photo upload', () => {
  it('uploads the selected file and shows the resulting image', async () => {
    uploadImage.mockResolvedValue({ data: { url: 'https://cdn.example.com/products/abc.jpg', key: 'products/abc.jpg' } });

    render(<ProductForm />);

    const fileInput = screen.getByLabelText(/product photo/i);
    selectFile(fileInput, makeFile());

    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByAltText(/product preview/i)).toHaveAttribute(
        'src',
        'https://cdn.example.com/products/abc.jpg',
      );
    });
    expect(screen.getByRole('button', { name: /replace photo/i })).toBeInTheDocument();
  });

  it('shows an error and does not fabricate a fallback image when the upload fails', async () => {
    uploadImage.mockResolvedValue({ error: 'Image storage (R2) is not configured' });

    render(<ProductForm />);

    const fileInput = screen.getByLabelText(/product photo/i);
    selectFile(fileInput, makeFile());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Image storage (R2) is not configured');
    });
    expect(screen.queryByAltText(/product preview/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add photo/i })).toBeInTheDocument();
  });

  it('includes the uploaded imageUrl in the product payload on create', async () => {
    uploadImage.mockResolvedValue({ data: { url: 'https://cdn.example.com/products/new.jpg', key: 'products/new.jpg' } });

    const { container } = render(<ProductForm />);

    selectFile(screen.getByLabelText(/product photo/i), makeFile());
    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByAltText(/product preview/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/bread \(white\)/i), { target: { value: 'Milk 1L', name: 'name' } });
    fireEvent.change(container.querySelector('input[name="costPrice"]')!, {
      target: { value: '10', name: 'costPrice' },
    });
    fireEvent.change(container.querySelector('input[name="sellPrice"]')!, {
      target: { value: '15', name: 'sellPrice' },
    });
    fireEvent.change(container.querySelector('input[name="quantity"]')!, {
      target: { value: '5', name: 'quantity' },
    });

    fireEvent.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => expect(addProduct).toHaveBeenCalledTimes(1));
    expect(addProduct.mock.calls[0][0]).toMatchObject({
      imageUrl: 'https://cdn.example.com/products/new.jpg',
    });
  });

  it('lets the user remove a photo, and clears imageUrl on the edit payload', async () => {
    mockParams = { id: 'prod-1' };
    mockProducts = [
      {
        id: 'prod-1',
        name: 'Existing Product',
        costPrice: 10,
        sellPrice: 15,
        quantity: 3,
        reorderAt: 10,
        unit: 'each',
        imageUrl: 'https://cdn.example.com/products/existing.jpg',
      },
    ];
    updateProduct.mockResolvedValue(undefined);

    render(<ProductForm />);

    await waitFor(() => {
      expect(screen.getByAltText(/product preview/i)).toHaveAttribute(
        'src',
        'https://cdn.example.com/products/existing.jpg',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }));

    expect(screen.queryByAltText(/product preview/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add photo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /update product/i }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
    expect(updateProduct.mock.calls[0][1]).toMatchObject({ imageUrl: '' });
  });
});

describe('ProductForm optional product payloads', () => {
  const saved = {
    id: 'prod-1', name: 'Soap', category: 'Other', costPrice: 5, sellPrice: 10,
    quantity: 3, reorderAt: 10, unit: 'each',
    attributes: { Colour: 'Blue' }, wholesalePrice: 0, wholesaleMinQty: 5,
    packPrice: 50, packSize: 6,
  };
  const set = (container: HTMLElement, name: string, value: string) => {
    fireEvent.change(container.querySelector(`input[name="${name}"]`)!, { target: { name, value } });
  };

  it('loads saved fields and submits them again on edit', async () => {
    mockParams = { id: saved.id };
    mockProducts = [saved];
    const { container } = render(<ProductForm />);
    await waitFor(() => expect(container.querySelector('input[name="packSize"]')).toHaveValue(6));
    expect(container.querySelector('input[name="wholesalePrice"]')).toHaveValue(0);
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
    expect(updateProduct.mock.calls[0][1]).toMatchObject({
      attributes: saved.attributes, wholesalePrice: 0, wholesaleMinQty: 5, packPrice: 50, packSize: 6,
    });
  });

  it('sends nulls when optional pricing and the final attribute are removed', async () => {
    mockParams = { id: saved.id };
    mockProducts = [saved];
    const { container } = render(<ProductForm />);
    await waitFor(() => expect(screen.getByPlaceholderText('e.g., Black')).toHaveValue('Blue'));
    for (const name of ['wholesalePrice', 'wholesaleMinQty', 'packPrice', 'packSize']) set(container, name, '');
    fireEvent.change(screen.getByPlaceholderText('e.g., Black'), { target: { value: '' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
    expect(JSON.parse(JSON.stringify(updateProduct.mock.calls[0][1]))).toMatchObject({
      attributes: null, wholesalePrice: null, wholesaleMinQty: null, packPrice: null, packSize: null,
    });
  });

  it('includes entered pricing on create and omits empty attributes', async () => {
    const { container } = render(<ProductForm />);
    for (const [name, value] of Object.entries({ name: 'Soap', costPrice: '5', sellPrice: '10', quantity: '3', wholesalePrice: '0', wholesaleMinQty: '5', packPrice: '50', packSize: '6' })) set(container, name, value);
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(addProduct).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(JSON.stringify(addProduct.mock.calls[0][0]));
    expect(payload).toMatchObject({ wholesalePrice: 0, wholesaleMinQty: 5, packPrice: 50, packSize: 6 });
    expect(payload).not.toHaveProperty('attributes');
  });

  it('includes a custom attribute in a create payload', async () => {
    const { container } = render(<ProductForm />);
    for (const [name, value] of Object.entries({ name: 'Soap', costPrice: '5', sellPrice: '10', quantity: '3' })) set(container, name, value);
    fireEvent.change(container.querySelector('select[name="category"]')!, { target: { name: 'category', value: 'Other' } });
    fireEvent.click(screen.getByRole('button', { name: /add custom attribute/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Color'), { target: { value: 'Colour' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., Black'), { target: { value: 'Blue' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(addProduct).toHaveBeenCalledTimes(1));
    expect(addProduct.mock.calls[0][0]).toMatchObject({ attributes: { Colour: 'Blue' } });
  });

  it('surfaces API validation errors without reporting a successful edit', async () => {
    mockParams = { id: saved.id };
    mockProducts = [saved];
    updateProduct.mockRejectedValueOnce(new Error('Validation failed'));
    const { container } = render(<ProductForm />);
    await waitFor(() => expect(container.querySelector('input[name="packSize"]')).toHaveValue(6));
    set(container, 'packSize', '1.5');
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(screen.getByText('Validation failed')).toBeInTheDocument());
    expect(updateProduct.mock.calls[0][1]).toMatchObject({ packSize: 1.5 });
  });
});
