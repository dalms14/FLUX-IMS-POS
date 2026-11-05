import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import ProductImageInput from './ProductImageInput';
import SettingsPage from '../pages/SettingsPage';

jest.mock('axios');
jest.mock('./Sidebar', () => () => null);
const imageUrl = 'https://images.example.com/coffee.jpg';
const transfer = data => ({ files: [], items: [], getData: type => data[type] || '' });
const dropBox = () => screen.getByRole('button', { name: 'Upload or drop product image' });
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

test.each([
  [{ 'text/html': `<a href="https://example.com/page"><img src="${imageUrl}" /></a>` }, imageUrl],
  [{ 'text/uri-list': `# Image link\r\n${imageUrl}` }, imageUrl],
  [{ 'text/plain': `https://www.google.com/imgres?imgurl=${encodeURIComponent(imageUrl)}` }, imageUrl],
])('imports an image dragged from another tab only after the image preview loads', (data, expected) => {
  const changed = jest.fn(), busy = jest.fn();
  render(<ProductImageInput value="" onChange={changed} onBusyChange={busy} />);
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: transfer(data) });
  fireEvent(dropBox(), event);
  expect(event.defaultPrevented).toBe(true);
  expect(changed).not.toHaveBeenCalled();
  const preview = screen.getByAltText('Product preview');
  expect(preview).toHaveAttribute('src', expected);
  fireEvent.load(preview);
  expect(changed).toHaveBeenCalledWith(expected);
  expect(busy).toHaveBeenLastCalledWith(false);
});

test.each(['drop', 'picker'])('accepts a local image through %s and converts it to a saved data URL', async mode => {
  const changed = jest.fn();
  render(<ProductImageInput value="" onChange={changed} onBusyChange={jest.fn()} />);
  const file = new File(['image bytes'], 'coffee.png', { type: 'image/png' });
  if (mode === 'drop') fireEvent.drop(dropBox(), { dataTransfer: { files: [file] } });
  else fireEvent.change(screen.getByLabelText('Choose product image file'), { target: { files: [file] } });
  fireEvent.load(await screen.findByAltText('Product preview'));
  expect(changed).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/));
});

test('blocked web images preserve the previous image and explain the file upload fallback', () => {
  const changed = jest.fn();
  render(<ProductImageInput value="data:image/png;base64,b2xk" onChange={changed} onBusyChange={jest.fn()} />);
  fireEvent.drop(dropBox(), { dataTransfer: transfer({ 'text/uri-list': imageUrl }) });
  fireEvent.error(screen.getByAltText('Product preview'));
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Download it, then drop the saved file');
  expect(screen.getByAltText('Product preview')).toHaveAttribute('src', 'data:image/png;base64,b2xk');
});

test('rejects oversized, unsupported files and non-image URL schemes without changing the product', () => {
  const changed = jest.fn();
  render(<ProductImageInput value="" onChange={changed} onBusyChange={jest.fn()} />);
  fireEvent.drop(dropBox(), { dataTransfer: { files: [new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG or WEBP');
  fireEvent.drop(dropBox(), { dataTransfer: { files: [new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('smaller than 2 MB');
  fireEvent.drop(dropBox(), { dataTransfer: transfer({ 'text/uri-list': 'javascript:alert(1)' }) });
  expect(screen.getByRole('alert')).toHaveTextContent('Drop an image or image link');
  expect(changed).not.toHaveBeenCalled();
});

test('a dropped image reaches the new product save payload and saving waits for its preview', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/categories') ? [{ _id: 'drinks', name: 'Drinks' }] : url.endsWith('/addons') ? { data: [] } : [] }));
  axios.post.mockResolvedValue({ data: { product: { _id: 'new-product' } } });
  axios.put.mockResolvedValue({ data: { success: true } });
  render(<SettingsPage mode="products" />);
  fireEvent.click(await screen.findByRole('button', { name: /\+ Add Product/ }));
  fireEvent.change(screen.getByPlaceholderText('e.g. Chicken Alaking'), { target: { value: 'Test Coffee' } });
  const category = screen.getByRole('option', { name: 'Select category...' }).parentElement;
  fireEvent.change(category, { target: { value: 'Drinks' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. 325'), { target: { value: '100' } });
  fireEvent.drop(dropBox(), { dataTransfer: transfer({ 'text/html': `<img src="${imageUrl}">` }) });
  const save = screen.getByRole('button', { name: 'Add Product' });
  expect(save).toBeDisabled();
  fireEvent.load(screen.getByAltText('Product preview'));
  await waitFor(() => expect(screen.getByRole('button', { name: '+ Add size or add-on recipe' })).toBeInTheDocument());
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/products', expect.objectContaining({ image: imageUrl, name: 'Test Coffee' })));
});
