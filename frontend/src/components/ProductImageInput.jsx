import React, { useEffect, useRef, useState } from 'react';
import { FiCamera } from 'react-icons/fi';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 2 * 1024 * 1024;

function droppedSource(transfer) {
  const markup = transfer.getData('text/html');
  if (markup) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    const source = template.content.querySelector('img')?.getAttribute('src');
    if (source) return source;
  }
  const links = transfer.getData('text/uri-list') || transfer.getData('text/plain');
  return links.split(/\r?\n/).find(line => line.trim() && !line.startsWith('#'))?.trim() || '';
}

function imageSource(raw) {
  if (/^data:image\/(jpeg|png|webp);base64,/i.test(raw)) {
    const content = raw.slice(raw.indexOf(',') + 1);
    if (content.length * 3 / 4 - (content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0) > maxBytes) throw new Error('Choose an image smaller than 2 MB.');
    return raw;
  }
  const url = new URL(raw);
  // Google Images may drag its result link instead of the actual image URL.
  if (/^(www\.)?google\.[a-z.]+$/i.test(url.hostname) && url.searchParams.get('imgurl')) return imageSource(url.searchParams.get('imgurl'));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsupported image link.');
  return url.href;
}

export default function ProductImageInput({ value, onChange, onBusyChange, disabled = false }) {
  const input = useRef(null);
  const reader = useRef(null);
  const sequence = useRef(0);
  const [pending, setPending] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  useEffect(() => () => { sequence.current++; reader.current?.abort(); }, []);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      sequence.current++; setPending(null); onBusyChange(false);
      setError('The image could not be loaded. Download it, then drop the saved file here.');
    }, 15000);
    return () => clearTimeout(timer);
  }, [pending, onBusyChange]);

  const begin = () => {
    sequence.current++; reader.current?.abort(); setPending(null); setReading(false); setError('');
    return sequence.current;
  };
  const fail = message => { sequence.current++; setPending(null); setReading(false); onBusyChange(false); setError(message); };
  const selectFile = file => {
    if (!file) return;
    const id = begin();
    if (!allowedTypes.has(file.type)) return fail('Use a JPG, PNG or WEBP image.');
    if (file.size > maxBytes) return fail('Choose an image smaller than 2 MB.');
    setReading(true); onBusyChange(true);
    const next = new FileReader(); reader.current = next;
    next.onload = () => {
      if (id !== sequence.current) return;
      setReading(false); setPending({ id, source: next.result, file: true });
    };
    next.onerror = () => { if (id === sequence.current) fail('Could not read this image. Try another file.'); };
    next.readAsDataURL(file);
  };
  const drop = event => {
    event.preventDefault(); event.stopPropagation(); setDragging(false);
    if (disabled) return;
    const transfer = event.dataTransfer;
    const file = transfer.files?.[0] || Array.from(transfer.items || []).find(item => item.kind === 'file')?.getAsFile();
    if (file) { selectFile(file); return; }
    const id = begin();
    try {
      const source = imageSource(droppedSource(transfer));
      onBusyChange(true); setPending({ id, source, file: false });
    } catch { fail('Drop an image or image link. If it cannot be dragged from that website, download and drop the file.'); }
  };
  const preview = pending?.source || value;
  return <div style={{ marginBottom: '20px', textAlign: 'center' }}>
    <button type="button" aria-label="Upload or drop product image" aria-describedby="product-image-help" disabled={disabled}
      onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); event.stopPropagation(); if (!disabled) { event.dataTransfer.dropEffect = 'copy'; setDragging(true); } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={drop}
      style={{ width: '120px', height: '120px', padding: 0, borderRadius: '12px', backgroundColor: dragging ? '#EEE2D5' : '#F5F0EB', border: `2px dashed ${dragging ? '#8B5E3C' : '#C4A87A'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', margin: '0 auto 8px', overflow: 'hidden' }}>
      {preview ? <img key={pending?.id || preview} src={preview} alt="Product preview" referrerPolicy="no-referrer" draggable={false}
        onLoad={() => { if (pending && pending.id === sequence.current) { onChange(pending.source); setPending(null); onBusyChange(false); } }}
        onError={() => { if (pending && pending.id === sequence.current) fail(pending.file ? 'This file is not a readable image. Try another JPG, PNG or WEBP.' : 'This website blocks the image or the link is not an image. Download it, then drop the saved file.'); }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        : <span style={{ color: '#A17C4C', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}><FiCamera size={26} /><span style={{ display: 'block', marginTop: '6px', fontSize: '10px', fontWeight: '600' }}>Click or drop image</span></span>}
    </button>
    <input ref={input} aria-label="Choose product image file" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} style={{ display: 'none' }} onChange={event => { selectFile(event.target.files?.[0]); event.target.value = ''; }} />
    <p id="product-image-help" style={{ fontSize: '11px', color: '#8A8178', margin: 0 }}>Drop an image from another tab or choose a file. JPG, PNG, WEBP files up to 2 MB.</p>
    {(pending || reading) && <p role="status" style={{ fontSize: '12px', color: '#8B5E3C' }}>Loading image...</p>}
    {error && <p role="alert" style={{ fontSize: '12px', color: '#A32C2C', margin: '8px 0 0' }}>{error}</p>}
  </div>;
}
