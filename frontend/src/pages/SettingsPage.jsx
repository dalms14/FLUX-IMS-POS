import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { isAdminRole } from '../utils/roles';
import { FiEdit2, FiSearch, FiTrash2 } from 'react-icons/fi';

const EMAIL_DOMAIN = '@elicoffee.com';

const normalizeEmailName = (value = '') =>
    value.toLowerCase().trim().replace(EMAIL_DOMAIN, '').replace(/@.*/, '');

const buildEliEmail = (value = '') => {
    const emailName = normalizeEmailName(value);
    return emailName ? `${emailName}${EMAIL_DOMAIN}` : '';
};

const AVAILABLE_ADDONS = [
    { name: 'Up size', price: 30 },
    { name: 'Ice Blended', price: 30 },
    { name: 'Cold brew Shot', price: 40 },
    { name: 'Whip Cream', price: 20 },
    { name: 'Milk', price: 30 },
    { name: 'Choco Kisses', price: 25 },
    { name: 'Cream Cheese', price: 25 },
    { name: 'Crushed Oreo', price: 20 },
    { name: 'Cheese Cake', price: 30 },
    { name: 'Nata', price: 20 },
];

const productTableGrid = 'minmax(190px, 2fr) minmax(120px, 1.5fr) minmax(74px, 1fr) minmax(82px, 1fr) 76px 92px 92px';

// ── Add/Edit Product Modal ──
const normalizeAddons = (addons = []) =>
    addons
        .filter(addon => addon?.name)
        .map(addon => ({
            name: addon.name,
            price: Number(addon.price) || 0,
        }));

const mergeAddonOptions = (availableAddons = [], productAddons = []) => {
    const map = new Map();

    [...availableAddons, ...productAddons].forEach(addon => {
        if (!addon?.name) return;
        map.set(addon.name, {
            name: addon.name,
            price: Number(addon.price) || 0,
        });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const normalizeRecipeIngredients = (ingredients = []) =>
    ingredients
        .filter(ingredient => ingredient?.inventoryId)
        .map(ingredient => ({
            inventoryId: String(ingredient.inventoryId?._id || ingredient.inventoryId),
            name: ingredient.name || ingredient.inventoryId?.name || '',
            unit: ingredient.unit || ingredient.inventoryId?.unit || '',
            amountPerServing: Number(ingredient.amountPerServing) || 0,
            platterMultiplier: Number(ingredient.platterMultiplier) || 3,
        }));

const productCategoriesOnly = (categories = []) =>
    categories.filter(cat => String(cat.name || '').toUpperCase() !== 'ALL');

const ProductFormModal = ({ product, categories, availableAddons = [], onSave, onClose }) => {
    const [form, setForm] = useState({
        name: product?.name || '',
        category: product?.categoryId?.name || product?.category || '',
        soloPrice: product?.soloPrice ?? product?.price ?? '',
        platterPrice: product?.platterPrice ?? '',
        description: product?.description || '',
        variants: product?.variants?.join(', ') || '',
        addons: normalizeAddons(product?.addons),
        recipeIngredients: [],
        image: product?.image || '',
    });
    const [inventoryItems, setInventoryItems] = useState([]);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(product?.image || '');
    const [recipeLoading, setRecipeLoading] = useState(false);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const fileRef = useRef();

    useEffect(() => {
        let alive = true;

        const fetchRecipeTools = async () => {
            setRecipeLoading(true);
            try {
                const requests = [
                    axios.get('http://localhost:5000/api/inventory'),
                ];

                if (product?._id) {
                    requests.push(axios.get(`http://localhost:5000/api/products/${product._id}/recipe`));
                }

                const [inventoryRes, recipeRes] = await Promise.all(requests);
                if (!alive) return;

                setInventoryItems(inventoryRes.data || []);

                if (recipeRes?.data?.recipe?.ingredients) {
                    setForm(f => ({
                        ...f,
                        recipeIngredients: normalizeRecipeIngredients(recipeRes.data.recipe.ingredients),
                    }));
                }
            } catch (err) {
                console.error('Error loading ingredients:', err);
            } finally {
                if (alive) setRecipeLoading(false);
            }
        };

        fetchRecipeTools();

        return () => {
            alive = false;
        };
    }, [product?._id]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const toggleAddon = (addon) => {
        setForm(f => {
            const exists = f.addons.some(a => a.name === addon.name);
            return {
                ...f,
                addons: exists
                    ? f.addons.filter(a => a.name !== addon.name)
                    : [...f.addons, addon],
            };
        });
    };

    const toggleIngredient = (ingredient) => {
        setForm(f => {
            const exists = f.recipeIngredients.some(item => item.inventoryId === ingredient._id);
            return {
                ...f,
                recipeIngredients: exists
                    ? f.recipeIngredients.filter(item => item.inventoryId !== ingredient._id)
                    : [
                        ...f.recipeIngredients,
                        {
                            inventoryId: ingredient._id,
                            name: ingredient.name,
                            unit: ingredient.unit,
                            amountPerServing: ingredient.unit === 'pcs' ? 1 : 30,
                            platterMultiplier: 3,
                        },
                    ],
            };
        });
    };

    const updateRecipeIngredient = (inventoryId, field, value) => {
        setForm(f => ({
            ...f,
            recipeIngredients: f.recipeIngredients.map(ingredient =>
                ingredient.inventoryId === inventoryId
                    ? { ...ingredient, [field]: value }
                    : ingredient
            ),
        }));
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.category || !form.soloPrice) {
            alert('Please fill in Name, Category and Solo Price.');
            return;
        }
        setSaving(true);
        try {
            let imageUrl = form.image;

            // If a new image file was selected, convert to base64
            if (imageFile) {
                imageUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageFile);
                });
            }

            const payload = {
                name: form.name.trim(),
                category: form.category,
                soloPrice: parseFloat(form.soloPrice),
                platterPrice: form.platterPrice ? parseFloat(form.platterPrice) : null,
                description: form.description.trim(),
                variants: form.variants ? form.variants.split(',').map(v => v.trim()).filter(Boolean) : [],
                addons: normalizeAddons(form.addons),
                image: imageUrl,
                available: true,
            };

            let savedProduct;
            if (product?._id) {
                const res = await axios.put(`http://localhost:5000/api/products/${product._id}`, payload);
                savedProduct = res.data.product;
            } else {
                const res = await axios.post('http://localhost:5000/api/products', payload);
                savedProduct = res.data.product;
            }

            const recipePayload = {
                ingredients: form.recipeIngredients
                    .map(ingredient => ({
                        inventoryId: ingredient.inventoryId,
                        amountPerServing: Number(ingredient.amountPerServing),
                        platterMultiplier: Number(ingredient.platterMultiplier) || 3,
                    }))
                    .filter(ingredient => ingredient.inventoryId && ingredient.amountPerServing > 0),
            };

            await axios.put(`http://localhost:5000/api/products/${savedProduct._id}/recipe`, recipePayload);

            onSave();
        } catch (err) {
            alert('Failed to save product. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const inputStyle = {
        width: '100%', padding: '9px 12px',
        border: '1.5px solid #ddd', borderRadius: '8px',
        fontSize: '13px', outline: 'none',
        boxSizing: 'border-box', fontFamily: 'Segoe UI, sans-serif',
    };

    const labelStyle = {
        fontSize: '11px', fontWeight: '700', color: '#666',
        textTransform: 'uppercase', letterSpacing: '0.8px',
        display: 'block', marginBottom: '6px',
    };

    const selectedIngredientIds = new Set(form.recipeIngredients.map(ingredient => ingredient.inventoryId));
    const addonOptions = mergeAddonOptions(availableAddons.length > 0 ? availableAddons : AVAILABLE_ADDONS, form.addons);
    const selectedIngredients = form.recipeIngredients
        .map(ingredient => ({
            ...ingredient,
            source: inventoryItems.find(item => item._id === ingredient.inventoryId),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const unselectedIngredients = inventoryItems
        .filter(ingredient => !selectedIngredientIds.has(ingredient._id))
        .sort((a, b) => a.name.localeCompare(b.name));
    const searchedIngredients = unselectedIngredients.filter(ingredient => {
        const query = ingredientSearch.trim().toLowerCase();
        if (!query) return true;
        return [
            ingredient.name,
            ingredient.unit,
            ingredient.category || 'General',
        ].some(value => String(value || '').toLowerCase().includes(query));
    });

    const handleAddIngredient = (ingredientId) => {
        const ingredient = inventoryItems.find(item => item._id === ingredientId);
        if (!ingredient) return;

        toggleIngredient(ingredient);
        setIngredientSearch('');
        setShowIngredientPicker(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', width: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', fontFamily: 'Segoe UI, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#1a1a1a' }}>
                        {product ? 'Edit Product' : 'Add New Product'}
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#aaa' }}>✕</button>
                </div>

                {/* Image Upload */}
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                    <div
                        onClick={() => fileRef.current.click()}
                        style={{
                            width: '120px', height: '120px', borderRadius: '12px',
                            backgroundColor: '#F5F0EB', border: '2px dashed #C4A87A',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', margin: '0 auto 8px', overflow: 'hidden',
                            transition: 'border-color 0.15s',
                        }}
                    >
                        {imagePreview
                            ? <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : (
                                <div style={{ textAlign: 'center', color: '#C4A87A' }}>
                                    <div style={{ fontSize: '28px' }}>📷</div>
                                    <div style={{ fontSize: '10px', fontWeight: '600', marginTop: '4px' }}>Click to upload</div>
                                </div>
                            )
                        }
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                    <p style={{ fontSize: '11px', color: '#aaa', margin: 0 }}>JPG, PNG, WEBP — max 2MB</p>
                </div>

                {/* Form Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Product Name *</label>
                        <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chicken Alaking" />
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Category *</label>
                        <select style={{ ...inputStyle, backgroundColor: '#fff' }}
                            value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                            <option value="">Select category...</option>
                            {productCategoriesOnly(categories).map(cat => (
                                <option key={cat._id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={labelStyle}>Solo Price (₱) *</label>
                        <input style={inputStyle} type="number" value={form.soloPrice}
                            onChange={e => setForm(f => ({ ...f, soloPrice: e.target.value }))} placeholder="e.g. 325" />
                    </div>

                    <div>
                        <label style={labelStyle}>Platter Price (₱)</label>
                        <input style={inputStyle} type="number" value={form.platterPrice}
                            onChange={e => setForm(f => ({ ...f, platterPrice: e.target.value }))} placeholder="Optional" />
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Variants (comma separated)</label>
                        <input style={inputStyle} value={form.variants}
                            onChange={e => setForm(f => ({ ...f, variants: e.target.value }))}
                            placeholder="e.g. Garlic Parmesan, Honey Glaze" />
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Allowed Add-ons</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                            {addonOptions.map(addon => {
                                const selected = form.addons.some(a => a.name === addon.name);
                                return (
                                    <button
                                        key={addon.name}
                                        type="button"
                                        onClick={() => toggleAddon(addon)}
                                        style={{
                                            padding: '9px 10px',
                                            border: `1.5px solid ${selected ? '#8B5E3C' : '#ddd'}`,
                                            borderRadius: '8px',
                                            backgroundColor: selected ? '#FDF5EE' : '#fff',
                                            color: selected ? '#8B5E3C' : '#555',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            textAlign: 'left',
                                        }}
                                    >
                                        {selected ? '✓ ' : ''}{addon.name} (+₱{addon.price})
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Ingredient Deduction</label>
                        {recipeLoading ? (
                            <div style={{ padding: '16px', border: '1px solid #E8DDD0', borderRadius: '10px', color: '#999', fontSize: '13px' }}>
                                Loading ingredients...
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'none' }}>
                                    {inventoryItems.map(ingredient => {
                                        const selected = selectedIngredientIds.has(ingredient._id);
                                        return (
                                            <button
                                                key={ingredient._id}
                                                type="button"
                                                onClick={() => toggleIngredient(ingredient)}
                                                style={{
                                                    padding: '9px 10px',
                                                    border: `1.5px solid ${selected ? '#8B5E3C' : '#ddd'}`,
                                                    borderRadius: '8px',
                                                    backgroundColor: selected ? '#FDF5EE' : '#fff',
                                                    color: selected ? '#8B5E3C' : '#555',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    textAlign: 'left',
                                                    minHeight: '48px',
                                                }}
                                            >
                                                {selected ? '✓ ' : ''}{ingredient.name}
                                                <span style={{ display: 'block', fontSize: '10px', color: selected ? '#A06B43' : '#aaa', marginTop: '2px' }}>
                                                    {ingredient.unit} · {ingredient.category || 'General'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div style={{ border: '1px solid #E8DDD0', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 34px', gap: '10px', padding: '9px 12px', backgroundColor: '#F5F0EB', alignItems: 'center' }}>
                                        {['Ingredient', 'Per Sale', 'Platter x'].map(header => (
                                            <p key={header} style={{ margin: 0, fontSize: '10px', color: '#8B5E3C', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{header}</p>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIngredientSearch('');
                                                setShowIngredientPicker(true);
                                            }}
                                            title="Add ingredient"
                                            style={{ width: '26px', height: '26px', border: '1px solid #C4A87A', borderRadius: '7px', backgroundColor: '#fff', color: '#8B5E3C', cursor: 'pointer', fontSize: '18px', fontWeight: '900', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            +
                                        </button>
                                    </div>
                                    {selectedIngredients.length === 0 ? (
                                        <div style={{ padding: '18px', textAlign: 'center', color: '#999', fontSize: '12px', fontWeight: '700', backgroundColor: '#fff' }}>
                                            No ingredients added yet. Click + to add one.
                                        </div>
                                    ) : (
                                        selectedIngredients.map(ingredient => (
                                            <div key={ingredient.inventoryId} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 34px', gap: '10px', padding: '10px 12px', alignItems: 'center', borderTop: '1px solid #F0E8E0' }}>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#1a1a1a' }}>{ingredient.name}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#999' }}>Unit: {ingredient.unit}</p>
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step={ingredient.unit === 'pcs' ? '1' : '0.01'}
                                                    value={ingredient.amountPerServing}
                                                    onChange={e => updateRecipeIngredient(ingredient.inventoryId, 'amountPerServing', e.target.value)}
                                                    style={inputStyle}
                                                />
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="0.1"
                                                    value={ingredient.platterMultiplier}
                                                    onChange={e => updateRecipeIngredient(ingredient.inventoryId, 'platterMultiplier', e.target.value)}
                                                    style={inputStyle}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => toggleIngredient({ _id: ingredient.inventoryId })}
                                                    title="Remove ingredient"
                                                    style={{ width: '30px', height: '30px', border: 'none', borderRadius: '6px', backgroundColor: '#FFF5F5', color: '#C53030', cursor: 'pointer', fontWeight: '900' }}
                                                >
                                                    x
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Description</label>
                        <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Short product description..." />
                    </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: '#f5f5f5', color: '#555', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        style={{ flex: 2, padding: '12px', backgroundColor: saving ? '#C4A87A' : '#8B5E3C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Saving...' : product ? 'Save Changes' : 'Add Product'}
                    </button>
                </div>
            </div>
            {showIngredientPicker && (
                <div
                    onClick={() => setShowIngredientPicker(false)}
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '18px' }}
                >
                    <div
                        onClick={event => event.stopPropagation()}
                        style={{ width: 'min(420px, 100%)', maxHeight: '78vh', backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 24px 64px rgba(0,0,0,0.24)', overflow: 'hidden' }}
                    >
                        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0E8E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#1a1a1a' }}>Add Ingredient</h4>
                                <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#999' }}>{unselectedIngredients.length} available ingredient{unselectedIngredients.length !== 1 ? 's' : ''}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowIngredientPicker(false)}
                                style={{ width: '32px', height: '32px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#7A6A5A', cursor: 'pointer', fontSize: '17px', fontWeight: '900' }}
                            >
                                x
                            </button>
                        </div>
                        <div style={{ padding: '14px 16px' }}>
                            <input
                                type="text"
                                value={ingredientSearch}
                                onChange={e => setIngredientSearch(e.target.value)}
                                autoFocus
                                disabled={unselectedIngredients.length === 0}
                                placeholder={unselectedIngredients.length === 0 ? 'All ingredients are already added' : 'Search ingredient by name, unit, or category...'}
                                style={{ ...inputStyle, backgroundColor: '#fff' }}
                            />
                            <div style={{ marginTop: '10px', border: '1px solid #E8DDD0', borderRadius: '10px', overflow: 'hidden', maxHeight: '340px', overflowY: 'auto' }}>
                                {unselectedIngredients.length === 0 ? (
                                    <p style={{ margin: 0, padding: '18px', fontSize: '12px', color: '#999', fontWeight: '700', textAlign: 'center' }}>All ingredients are already added.</p>
                                ) : searchedIngredients.length === 0 ? (
                                    <p style={{ margin: 0, padding: '18px', fontSize: '12px', color: '#999', fontWeight: '700', textAlign: 'center' }}>No matching ingredients found.</p>
                                ) : (
                                    searchedIngredients.map((ingredient, index) => (
                                        <button
                                            key={ingredient._id}
                                            type="button"
                                            onClick={() => handleAddIngredient(ingredient._id)}
                                            style={{ width: '100%', padding: '11px 13px', border: 'none', borderBottom: index === searchedIngredients.length - 1 ? 'none' : '1px solid #F0E8E0', backgroundColor: '#fff', color: '#333', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '800' }}
                                        >
                                            {ingredient.name}
                                            <span style={{ display: 'block', marginTop: '2px', color: '#999', fontSize: '10px', fontWeight: '700' }}>
                                                {ingredient.unit} - {ingredient.category || 'General'}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Delete Confirmation Modal ──
const DeleteModal = ({ product, onConfirm, onClose }) => (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', width: '360px', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', fontFamily: 'Segoe UI, sans-serif' }}>
            <div style={{ width: '52px', height: '52px', margin: '0 auto 14px', borderRadius: '14px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiTrash2 size={28} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '0 0 8px', color: '#1a1a1a' }}>Delete Product?</h3>
            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px' }}>
                Are you sure you want to delete <strong>{product?.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: '#f5f5f5', color: '#555', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={onConfirm} style={{ flex: 1, padding: '12px', backgroundColor: '#E53E3E', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Delete</button>
            </div>
        </div>
    </div>
);

// ── Inventory Settings Section ──
const AddonDeleteModal = ({ addon, onConfirm, onClose }) => (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', width: '360px', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', fontFamily: 'Segoe UI, sans-serif' }}>
            <div style={{ width: '52px', height: '52px', margin: '0 auto 14px', borderRadius: '14px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiTrash2 size={28} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '0 0 8px', color: '#1a1a1a' }}>Delete Add-on?</h3>
            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px', lineHeight: 1.5 }}>
                Do you really want to delete <strong>{addon?.name}</strong>? It will be removed from the master add-ons list.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: '#f5f5f5', color: '#555', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={onConfirm} style={{ flex: 1, padding: '12px', backgroundColor: '#E53E3E', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Delete</button>
            </div>
        </div>
    </div>
);

const DiscountDeleteModal = ({ discount, onConfirm, onClose }) => (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', width: '360px', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', fontFamily: 'Segoe UI, sans-serif' }}>
            <div style={{ width: '52px', height: '52px', margin: '0 auto 14px', borderRadius: '14px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiTrash2 size={28} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '0 0 8px', color: '#1a1a1a' }}>Delete Discount?</h3>
            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px', lineHeight: 1.5 }}>
                Do you really want to delete <strong>{discount?.name}</strong>? It will be removed from the master discounts list.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: '#f5f5f5', color: '#555', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={onConfirm} style={{ flex: 1, padding: '12px', backgroundColor: '#E53E3E', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Delete</button>
            </div>
        </div>
    </div>
);

const SYSTEM_DISCOUNT_NAMES = new Set(['elite member']);
const isSystemDiscountName = (name = '') => SYSTEM_DISCOUNT_NAMES.has(String(name).trim().toLowerCase());

const CategoryFormModal = ({ onSave, onClose }) => {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Please enter a category name.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            await axios.post('http://localhost:5000/api/categories', { name: name.trim() });
            onSave();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create category.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', width: '380px', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', fontFamily: 'Segoe UI, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#1a1a1a' }}>Add Category</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#aaa' }}>x</button>
                </div>

                <label style={{ fontSize: '11px', fontWeight: '800', color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px' }}>
                    Category Name *
                </label>
                <input
                    value={name}
                    onChange={e => { setName(e.target.value); setError(''); }}
                    placeholder="e.g. Desserts"
                    autoFocus
                    style={{ width: '100%', padding: '11px 12px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: error ? '10px' : '20px' }}
                />

                {error && (
                    <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: '#f5f5f5', color: '#555', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '12px', backgroundColor: saving ? '#C4A87A' : '#8B5E3C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Saving...' : 'Add Category'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const InventorySettings = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [addons, setAddons] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [deleteProduct, setDeleteProduct] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProducts = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/products?includeImages=true');
            setProducts(res.data);
        } catch (err) {
            console.error('Error fetching products:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/categories');
            setCategories(res.data);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const fetchAddons = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/addons');
            setAddons(res.data.data || []);
        } catch (err) {
            console.error('Error fetching add-ons:', err);
            setAddons(AVAILABLE_ADDONS);
        }
    };

    useEffect(() => { fetchProducts(); fetchCategories(); fetchAddons(); }, []);

    const handleDelete = async () => {
        try {
            await axios.delete(`http://localhost:5000/api/products/${deleteProduct._id}`);
            setDeleteProduct(null);
            fetchProducts();
        } catch (err) {
            alert('Failed to delete product.');
        }
    };

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.categoryId?.name || p.category || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div>
            {/* Toolbar */}
            <div className="products-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <button
                    onClick={() => setShowAddModal(true)}
                    style={{ padding: '10px 20px', backgroundColor: '#8B5E3C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                    + Add Product
                </button>
                <button
                    onClick={() => setShowCategoryModal(true)}
                    style={{ padding: '10px 18px', backgroundColor: '#fff', color: '#8B5E3C', border: '1.5px solid #8B5E3C', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                >
                    + Add Category
                </button>
                <input
                    type="text" placeholder="Search products..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    style={{ padding: '10px 16px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px' }}
                />
                <p style={{ fontSize: '12px', color: '#aaa', margin: 0, marginLeft: 'auto' }}>
                    {filtered.length} product{filtered.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Table */}
            <div className="products-table-card" style={{ backgroundColor: '#fff', borderRadius: '12px', overflowX: 'auto', overflowY: 'hidden', border: '1px solid #E0D5CB', maxWidth: '100%' }}>
                <div style={{ minWidth: '820px' }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: productTableGrid, padding: '12px 20px', backgroundColor: '#1A1208', gap: '12px' }}>
                        {['Product Name', 'Category', 'Solo', 'Platter', 'Image', 'Edit', 'Delete'].map(h => (
                            <p key={h} style={{ fontSize: '11px', fontWeight: '700', color: '#C4894A', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>{h}</p>
                        ))}
                    </div>

                    {/* Rows */}
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#bbb' }}>Loading products...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#bbb' }}>No products found.</div>
                    ) : (
                        filtered.map((product, i) => (
                            <div key={product._id} style={{ display: 'grid', gridTemplateColumns: productTableGrid, padding: '12px 20px', gap: '12px', backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}>
                            <div>
                                <p style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', margin: 0 }}>{product.name}</p>
                                {product.variants?.length > 0 && (
                                    <p style={{ fontSize: '10px', color: '#aaa', margin: '2px 0 0', fontStyle: 'italic' }}>{product.variants.join(', ')}</p>
                                )}
                                {product.addons?.length > 0 && (
                                    <p style={{ fontSize: '10px', color: '#8B5E3C', margin: '2px 0 0', fontStyle: 'italic' }}>
                                        Add-ons: {product.addons.map(a => a.name).join(', ')}
                                    </p>
                                )}
                            </div>
                            <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>{product.categoryId?.name || product.category || '—'}</p>
                            <p style={{ fontSize: '13px', fontWeight: '700', color: '#8B5E3C', margin: 0 }}>₱{(product.soloPrice ?? product.price)?.toLocaleString()}</p>
                            <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>{product.platterPrice ? `₱${product.platterPrice.toLocaleString()}` : '—'}</p>

                            {/* Image */}
                            <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#F0E8E0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {product.image
                                    ? <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <span style={{ fontSize: '18px' }}>🖼</span>
                                }
                            </div>

                            {/* Edit */}
                            <button
                                onClick={() => setEditProduct(product)}
                                style={{ padding: '7px 12px', backgroundColor: '#EBF8FF', color: '#2B6CB0', border: '1px solid #BEE3F8', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                <FiEdit2 size={13} /> Edit
                            </button>

                            {/* Delete */}
                            <button
                                onClick={() => setDeleteProduct(product)}
                                style={{ padding: '7px 12px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                <FiTrash2 size={13} /> Del
                            </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modals */}
            {showAddModal && (
                <ProductFormModal
                    categories={categories}
                    availableAddons={addons}
                    onSave={() => { setShowAddModal(false); fetchProducts(); }}
                    onClose={() => setShowAddModal(false)}
                />
            )}
            {showCategoryModal && (
                <CategoryFormModal
                    onSave={() => { setShowCategoryModal(false); fetchCategories(); }}
                    onClose={() => setShowCategoryModal(false)}
                />
            )}
            {editProduct && (
                <ProductFormModal
                    product={editProduct}
                    categories={categories}
                    availableAddons={addons}
                    onSave={() => { setEditProduct(null); fetchProducts(); }}
                    onClose={() => setEditProduct(null)}
                />
            )}
            {deleteProduct && (
                <DeleteModal
                    product={deleteProduct}
                    onConfirm={handleDelete}
                    onClose={() => setDeleteProduct(null)}
                />
            )}
        </div>
    );
};

// ── Main Settings Page ──
// -- User Account Settings Section --
const AddonSettings = () => {
    const [addons, setAddons] = useState([]);
    const [form, setForm] = useState({ name: '', price: '' });
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteAddon, setDeleteAddon] = useState(null);

    const loadAddons = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5000/api/addons');
            setAddons(res.data.data || []);
        } catch (err) {
            console.error('Error loading add-ons:', err);
            setMessage({ type: 'error', text: 'Failed to load add-ons.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAddons(); }, [loadAddons]);

    const filteredAddons = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return addons;

        return addons.filter(addon => (
            addon.name?.toLowerCase().includes(query) ||
            String(addon.price ?? '').includes(query)
        ));
    }, [addons, searchQuery]);

    const resetForm = () => {
        setForm({ name: '', price: '' });
        setEditing(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const payload = { name: form.name.trim(), price: Number(form.price) };
            if (editing) {
                await axios.put(`http://localhost:5000/api/addons/${editing._id}`, payload);
                setMessage({ type: 'success', text: 'Add-on updated.' });
            } else {
                await axios.post('http://localhost:5000/api/addons', payload);
                setMessage({ type: 'success', text: 'Add-on added.' });
            }

            resetForm();
            loadAddons();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save add-on.' });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (addon) => {
        setEditing(addon);
        setForm({ name: addon.name, price: addon.price });
        setMessage(null);
    };

    const handleDelete = async () => {
        if (!deleteAddon) return;

        try {
            await axios.delete(`http://localhost:5000/api/addons/${deleteAddon._id}`);
            setMessage({ type: 'success', text: 'Add-on removed.' });
            setDeleteAddon(null);
            loadAddons();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove add-on.' });
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '11px 12px',
        border: '1.5px solid #ddd',
        borderRadius: '8px',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box',
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: '20px' }}>
            <form onSubmit={handleSubmit} style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '22px', height: 'fit-content' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '900', color: '#1a1a1a' }}>
                    {editing ? 'Edit Add-on' : 'Add New Add-on'}
                </h3>
                <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Name</label>
                    <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Extra Shot" style={inputStyle} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Price</label>
                    <input type="number" min="0" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} placeholder="e.g. 30" style={inputStyle} />
                </div>
                {message && (
                    <div style={{ padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', fontWeight: '700', color: message.type === 'success' ? '#276749' : '#C53030', backgroundColor: message.type === 'success' ? '#F0FFF4' : '#FFF5F5', border: `1px solid ${message.type === 'success' ? '#C6F6D5' : '#FED7D7'}` }}>
                        {message.text}
                    </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                    {editing && (
                        <button type="button" onClick={resetForm} style={{ flex: 1, padding: '11px', border: '1px solid #D4B89A', borderRadius: '8px', backgroundColor: '#fff', color: '#6F4A2F', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    )}
                    <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', border: 'none', borderRadius: '8px', backgroundColor: saving ? '#C4A87A' : '#8B5E3C', color: '#fff', fontSize: '13px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Saving...' : editing ? 'Save Add-on' : 'Add Add-on'}
                    </button>
                </div>
            </form>

            <div style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid #F0E8E0', backgroundColor: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1.5px solid #ddd', borderRadius: '9px', overflow: 'hidden', backgroundColor: '#fff' }}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search add-ons..."
                            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: '10px 12px', fontSize: '13px', fontFamily: 'Segoe UI, sans-serif' }}
                        />
                        <button
                            type="button"
                            aria-label="Search add-ons"
                            style={{ width: '42px', height: '40px', border: 'none', borderLeft: '1px solid #E8DDD0', backgroundColor: '#F7F1EC', color: '#8B5E3C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                            <FiSearch size={16} />
                        </button>
                    </div>
                    <p style={{ margin: 0, minWidth: '86px', textAlign: 'right', fontSize: '12px', color: '#999', fontWeight: '700' }}>
                        {filteredAddons.length} add-on{filteredAddons.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 92px 92px', gap: '12px', padding: '12px 18px', backgroundColor: '#1A1208' }}>
                    {['Add-on', 'Price', 'Edit', 'Delete'].map(header => (
                        <p key={header} style={{ margin: 0, fontSize: '11px', color: '#C4894A', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{header}</p>
                    ))}
                </div>
                {loading ? (
                    <div style={{ padding: '38px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>Loading add-ons...</div>
                ) : addons.length === 0 ? (
                    <div style={{ padding: '38px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>No add-ons yet.</div>
                ) : filteredAddons.length === 0 ? (
                    <div style={{ padding: '38px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>No add-ons match your search.</div>
                ) : (
                    filteredAddons.map((addon, index) => (
                        <div key={addon._id || addon.name} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 92px 92px', gap: '12px', alignItems: 'center', padding: '12px 18px', borderBottom: index === filteredAddons.length - 1 ? 'none' : '1px solid #F0E8E0', backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#1a1a1a' }}>{addon.name}</p>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#8B5E3C' }}>PHP {Number(addon.price || 0).toLocaleString()}</p>
                            <button onClick={() => handleEdit(addon)} style={{ padding: '7px 10px', backgroundColor: '#EBF8FF', color: '#2B6CB0', border: '1px solid #BEE3F8', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FiEdit2 size={13} /> Edit</button>
                            <button onClick={() => setDeleteAddon(addon)} style={{ padding: '7px 10px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FiTrash2 size={13} /> Del</button>
                        </div>
                    ))
                )}
            </div>
            {deleteAddon && (
                <AddonDeleteModal
                    addon={deleteAddon}
                    onConfirm={handleDelete}
                    onClose={() => setDeleteAddon(null)}
                />
            )}
        </div>
    );
};

const DiscountSettings = () => {
    const [discounts, setDiscounts] = useState([]);
    const [form, setForm] = useState({ name: '', percentage: '' });
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteDiscount, setDeleteDiscount] = useState(null);

    const loadDiscounts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5000/api/discounts');
            setDiscounts(res.data.data || []);
        } catch (err) {
            console.error('Error loading discounts:', err);
            setMessage({ type: 'error', text: 'Failed to load discounts.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadDiscounts(); }, [loadDiscounts]);

    const filteredDiscounts = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const editableDiscounts = discounts.filter(discount => !isSystemDiscountName(discount.name));
        if (!query) return editableDiscounts;

        return editableDiscounts.filter(discount => (
            discount.name?.toLowerCase().includes(query) ||
            String(discount.percentage ?? '').includes(query)
        ));
    }, [discounts, searchQuery]);

    const resetForm = () => {
        setForm({ name: '', percentage: '' });
        setEditing(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const payload = { name: form.name.trim(), percentage: Number(form.percentage) };
            if (isSystemDiscountName(payload.name)) {
                setMessage({ type: 'error', text: 'Elite Member is a system discount and is not editable here.' });
                return;
            }

            if (editing) {
                await axios.put(`http://localhost:5000/api/discounts/${editing._id}`, payload);
                setMessage({ type: 'success', text: 'Discount updated.' });
            } else {
                await axios.post('http://localhost:5000/api/discounts', payload);
                setMessage({ type: 'success', text: 'Discount added.' });
            }

            resetForm();
            loadDiscounts();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save discount.' });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (discount) => {
        if (isSystemDiscountName(discount.name)) return;
        setEditing(discount);
        setForm({ name: discount.name, percentage: discount.percentage });
        setMessage(null);
    };

    const handleDelete = async () => {
        if (!deleteDiscount) return;
        if (isSystemDiscountName(deleteDiscount.name)) {
            setMessage({ type: 'error', text: 'Elite Member is a system discount and cannot be deleted.' });
            setDeleteDiscount(null);
            return;
        }

        try {
            await axios.delete(`http://localhost:5000/api/discounts/${deleteDiscount._id}`);
            setMessage({ type: 'success', text: 'Discount removed.' });
            setDeleteDiscount(null);
            loadDiscounts();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove discount.' });
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '11px 12px',
        border: '1.5px solid #ddd',
        borderRadius: '8px',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box',
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: '20px' }}>
            <form onSubmit={handleSubmit} style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '22px', height: 'fit-content' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '900', color: '#1a1a1a' }}>
                    {editing ? 'Edit Discount' : 'Add New Discount'}
                </h3>
                <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Name</label>
                    <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Student Discount" style={inputStyle} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Discount %</label>
                    <input type="number" min="0" max="100" step="0.01" value={form.percentage} onChange={e => setForm(prev => ({ ...prev, percentage: e.target.value }))} placeholder="e.g. 20" style={inputStyle} />
                </div>
                {message && (
                    <div style={{ padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', fontWeight: '700', color: message.type === 'success' ? '#276749' : '#C53030', backgroundColor: message.type === 'success' ? '#F0FFF4' : '#FFF5F5', border: `1px solid ${message.type === 'success' ? '#C6F6D5' : '#FED7D7'}` }}>
                        {message.text}
                    </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                    {editing && (
                        <button type="button" onClick={resetForm} style={{ flex: 1, padding: '11px', border: '1px solid #D4B89A', borderRadius: '8px', backgroundColor: '#fff', color: '#6F4A2F', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    )}
                    <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', border: 'none', borderRadius: '8px', backgroundColor: saving ? '#C4A87A' : '#8B5E3C', color: '#fff', fontSize: '13px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Saving...' : editing ? 'Save Discount' : 'Add Discount'}
                    </button>
                </div>
            </form>

            <div style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid #F0E8E0', backgroundColor: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1.5px solid #ddd', borderRadius: '9px', overflow: 'hidden', backgroundColor: '#fff' }}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search discounts..."
                            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: '10px 12px', fontSize: '13px', fontFamily: 'Segoe UI, sans-serif' }}
                        />
                        <button
                            type="button"
                            aria-label="Search discounts"
                            style={{ width: '42px', height: '40px', border: 'none', borderLeft: '1px solid #E8DDD0', backgroundColor: '#F7F1EC', color: '#8B5E3C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                            <FiSearch size={16} />
                        </button>
                    </div>
                    <p style={{ margin: 0, minWidth: '92px', textAlign: 'right', fontSize: '12px', color: '#999', fontWeight: '700' }}>
                        {filteredDiscounts.length} discount{filteredDiscounts.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 92px 92px', gap: '12px', padding: '12px 18px', backgroundColor: '#1A1208' }}>
                    {['Discount', 'Discount %', 'Edit', 'Delete'].map(header => (
                        <p key={header} style={{ margin: 0, fontSize: '11px', color: '#C4894A', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{header}</p>
                    ))}
                </div>
                {loading ? (
                    <div style={{ padding: '38px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>Loading discounts...</div>
                ) : discounts.filter(discount => !isSystemDiscountName(discount.name)).length === 0 ? (
                    <div style={{ padding: '38px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>No discounts yet.</div>
                ) : filteredDiscounts.length === 0 ? (
                    <div style={{ padding: '38px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>No discounts match your search.</div>
                ) : (
                    filteredDiscounts.map((discount, index) => (
                        <div key={discount._id || discount.name} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 92px 92px', gap: '12px', alignItems: 'center', padding: '12px 18px', borderBottom: index === filteredDiscounts.length - 1 ? 'none' : '1px solid #F0E8E0', backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#1a1a1a' }}>{discount.name}</p>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#8B5E3C' }}>{Number(discount.percentage || 0).toLocaleString()}%</p>
                            <button onClick={() => handleEdit(discount)} style={{ padding: '7px 10px', backgroundColor: '#EBF8FF', color: '#2B6CB0', border: '1px solid #BEE3F8', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FiEdit2 size={13} /> Edit</button>
                            <button onClick={() => setDeleteDiscount(discount)} style={{ padding: '7px 10px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FiTrash2 size={13} /> Del</button>
                        </div>
                    ))
                )}
            </div>
            {deleteDiscount && (
                <DiscountDeleteModal
                    discount={deleteDiscount}
                    onConfirm={handleDelete}
                    onClose={() => setDeleteDiscount(null)}
                />
            )}
        </div>
    );
};

const UserAccountSettings = () => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const canCreateUsers = isAdminRole(currentUser.role);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        userId: '',
        pin: '',
        role: 'staff',
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const inputStyle = {
        width: '100%',
        padding: '11px 12px',
        border: '1.5px solid #ddd',
        borderRadius: '8px',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'Segoe UI, sans-serif',
        backgroundColor: '#fff',
    };

    const labelStyle = {
        fontSize: '11px',
        fontWeight: '800',
        color: '#6B5A4C',
        textTransform: 'uppercase',
        letterSpacing: '0.7px',
        display: 'block',
        marginBottom: '6px',
    };

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setMessage(null);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        const accountEmail = buildEliEmail(form.email);

        if (!form.name.trim() || !accountEmail || !form.password || !form.role) {
            setMessage({ type: 'error', text: 'Please fill in name, email, password, and role.' });
            return;
        }

        if (form.pin && form.pin.length !== 6) {
            setMessage({ type: 'error', text: 'PIN must be exactly 6 digits.' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const res = await axios.post('http://localhost:5000/api/auth/users', {
                name: form.name.trim(),
                email: accountEmail,
                password: form.password,
                role: form.role,
                userId: form.userId.trim(),
                pin: form.pin.trim(),
            });

            setMessage({
                type: 'success',
                text: `Created ${res.data.user.name} as ${res.data.user.role}. User ID: ${res.data.user.userId}`,
            });
            setForm({ name: '', email: '', password: '', userId: '', pin: '', role: 'staff' });
        } catch (err) {
            const serverMessage = err.response?.data?.message;
            const fallbackMessage = err.response?.status === 404
                ? 'User creation endpoint is not available yet. Please restart the backend server.'
                : 'Failed to create user. Please try again.';

            setMessage({
                type: 'error',
                text: serverMessage || fallbackMessage,
            });
        } finally {
            setSaving(false);
        }
    };

    if (!canCreateUsers) {
        return (
            <div style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '22px', color: '#7A6A5D', fontSize: '14px' }}>
                Only admin users can create new staff or admin accounts.
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: '20px', alignItems: 'start' }}>
            <form onSubmit={handleCreateUser} style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Full Name *</label>
                        <input style={inputStyle} value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Maria Santos" />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Email Username *</label>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            border: '1.5px solid #ddd',
                            borderRadius: '8px',
                            backgroundColor: '#fff',
                            boxSizing: 'border-box',
                        }}>
                            <input
                                type="text"
                                style={{
                                    ...inputStyle,
                                    flex: 1,
                                    minWidth: 0,
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                }}
                                value={form.email}
                                onChange={e => updateField('email', normalizeEmailName(e.target.value))}
                                placeholder="staff"
                            />
                            <span style={{
                                padding: '0 12px 0 8px',
                                color: '#8B5E3C',
                                fontSize: '12px',
                                fontWeight: '800',
                                whiteSpace: 'nowrap',
                            }}>
                                {EMAIL_DOMAIN}
                            </span>
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Temporary Password *</label>
                        <input type="password" style={inputStyle} value={form.password} onChange={e => updateField('password', e.target.value)} placeholder="Minimum 6 characters" />
                    </div>
                    <div>
                        <label style={labelStyle}>PIN</label>
                        <input style={inputStyle} inputMode="numeric" maxLength="6" value={form.pin} onChange={e => updateField('pin', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 digits" />
                    </div>
                    <div>
                        <label style={labelStyle}>User ID</label>
                        <input style={inputStyle} value={form.userId} onChange={e => updateField('userId', e.target.value)} placeholder="Auto-generated if blank" />
                    </div>
                    <div>
                        <label style={labelStyle}>Role *</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {['staff', 'admin'].map(role => (
                                <button key={role} type="button" onClick={() => updateField('role', role)}
                                    style={{
                                        padding: '11px 10px',
                                        border: `1.5px solid ${form.role === role ? '#8B5E3C' : '#ddd'}`,
                                        borderRadius: '8px',
                                        backgroundColor: form.role === role ? '#FDF5EE' : '#fff',
                                        color: form.role === role ? '#8B5E3C' : '#555',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '800',
                                        textTransform: 'uppercase',
                                    }}>
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {message && (
                    <div style={{
                        marginTop: '16px',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        backgroundColor: message.type === 'success' ? '#F0FFF4' : '#FFF5F5',
                        color: message.type === 'success' ? '#276749' : '#C53030',
                        border: `1px solid ${message.type === 'success' ? '#C6F6D5' : '#FED7D7'}`,
                    }}>
                        {message.text}
                    </div>
                )}

                <button type="submit" disabled={saving}
                    style={{
                        marginTop: '18px',
                        width: '100%',
                        padding: '13px',
                        backgroundColor: saving ? '#C4A87A' : '#8B5E3C',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: saving ? 'not-allowed' : 'pointer',
                    }}>
                    {saving ? 'Creating User...' : 'Create User'}
                </button>
            </form>

            <aside style={{ backgroundColor: '#F0E8E0', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '18px' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '900', color: '#3D1F0D' }}>New account setup</h3>
                <p style={{ margin: '0 0 10px', fontSize: '12px', lineHeight: 1.5, color: '#6B5A4C' }}>
                    Staff accounts can use POS workflows. Admin accounts can access management pages such as sales, inventory, and settings.
                </p>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#8B5E3C', fontWeight: '700' }}>
                    Leave User ID blank to assign the next ELI number automatically.
                </p>
            </aside>
        </div>
    );
};

// -- Change Password Settings Section --
const ChangePasswordSettings = () => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const inputStyle = {
        width: '100%',
        padding: '11px 12px',
        border: '1.5px solid #ddd',
        borderRadius: '8px',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'Segoe UI, sans-serif',
        backgroundColor: '#fff',
    };

    const labelStyle = {
        fontSize: '11px',
        fontWeight: '800',
        color: '#6B5A4C',
        textTransform: 'uppercase',
        letterSpacing: '0.7px',
        display: 'block',
        marginBottom: '6px',
    };

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setMessage(null);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();

        if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
            setMessage({ type: 'error', text: 'Please fill in all password fields.' });
            return;
        }

        if (form.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
            return;
        }

        if (form.newPassword !== form.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            await axios.post('http://localhost:5000/api/auth/change-password', {
                email: currentUser.email,
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
            });

            setMessage({ type: 'success', text: 'Password changed successfully.' });
            setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setMessage({
                type: 'error',
                text: err.response?.data?.message || 'Failed to change password. Please try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 460px) 260px', gap: '20px', alignItems: 'start' }}>
            <form onSubmit={handleChangePassword} style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '22px' }}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Current Password *</label>
                    <input
                        type="password"
                        style={inputStyle}
                        value={form.currentPassword}
                        onChange={e => updateField('currentPassword', e.target.value)}
                        placeholder="Enter your current password"
                    />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>New Password *</label>
                    <input
                        type="password"
                        style={inputStyle}
                        value={form.newPassword}
                        onChange={e => updateField('newPassword', e.target.value)}
                        placeholder="Minimum 6 characters"
                    />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Confirm New Password *</label>
                    <input
                        type="password"
                        style={inputStyle}
                        value={form.confirmPassword}
                        onChange={e => updateField('confirmPassword', e.target.value)}
                        placeholder="Re-enter new password"
                    />
                </div>

                {message && (
                    <div style={{
                        marginBottom: '16px',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        backgroundColor: message.type === 'success' ? '#F0FFF4' : '#FFF5F5',
                        color: message.type === 'success' ? '#276749' : '#C53030',
                        border: `1px solid ${message.type === 'success' ? '#C6F6D5' : '#FED7D7'}`,
                    }}>
                        {message.text}
                    </div>
                )}

                <button type="submit" disabled={saving}
                    style={{
                        width: '100%',
                        padding: '13px',
                        backgroundColor: saving ? '#C4A87A' : '#8B5E3C',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: saving ? 'not-allowed' : 'pointer',
                    }}>
                    {saving ? 'Changing Password...' : 'Change Password'}
                </button>
            </form>

            <aside style={{ backgroundColor: '#F0E8E0', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '18px' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '900', color: '#3D1F0D' }}>Account security</h3>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#6B5A4C' }}>
                    Use a password that is different from your current one. After changing it, use the new password the next time you sign in.
                </p>
            </aside>
        </div>
    );
};

const SystemBackupSettings = () => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const [exporting, setExporting] = useState(false);
    const [message, setMessage] = useState(null);
    const [lastBackup, setLastBackup] = useState(localStorage.getItem('lastBackupAt') || '');

    const backupSources = [
        { key: 'products', label: 'Products', url: 'http://localhost:5000/api/products?includeImages=true' },
        { key: 'categories', label: 'Categories', url: 'http://localhost:5000/api/categories' },
        { key: 'addons', label: 'Add-ons', url: 'http://localhost:5000/api/addons' },
        { key: 'discounts', label: 'Discounts', url: 'http://localhost:5000/api/discounts' },
        { key: 'inventory', label: 'Inventory', url: 'http://localhost:5000/api/inventory' },
        { key: 'transactions', label: 'Transactions', url: 'http://localhost:5000/api/transactions' },
        { key: 'refunds', label: 'Refunds', url: 'http://localhost:5000/api/refunds' },
    ];

    const normalizePayload = (payload) => payload?.data || payload || [];

    const formatBackupDate = (dateString) => {
        if (!dateString) return 'No backup created yet';
        return new Date(dateString).toLocaleString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const downloadBackup = (backup) => {
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const link = document.createElement('a');

        link.href = url;
        link.download = `flux-backup-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleExportBackup = async () => {
        setExporting(true);
        setMessage(null);

        try {
            const results = await Promise.allSettled(
                backupSources.map(source => axios.get(source.url))
            );

            const failedSources = [];
            const data = {};
            const counts = {};

            results.forEach((result, index) => {
                const source = backupSources[index];

                if (result.status === 'fulfilled') {
                    const rows = normalizePayload(result.value.data);
                    data[source.key] = rows;
                    counts[source.key] = Array.isArray(rows) ? rows.length : 0;
                } else {
                    failedSources.push(source.label);
                    data[source.key] = [];
                    counts[source.key] = 0;
                }
            });

            if (failedSources.length > 0) {
                setMessage({
                    type: 'error',
                    text: `Backup incomplete. Failed to load: ${failedSources.join(', ')}.`,
                });
                return;
            }

            const createdAt = new Date().toISOString();
            const backup = {
                app: 'FLUX POS',
                version: '1.0',
                createdAt,
                createdBy: {
                    name: currentUser.name || '',
                    email: currentUser.email || '',
                    role: currentUser.role || '',
                },
                counts,
                data,
            };

            downloadBackup(backup);
            localStorage.setItem('lastBackupAt', createdAt);
            setLastBackup(createdAt);
            setMessage({ type: 'success', text: 'Backup file exported successfully.' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to export backup. Please try again.' });
        } finally {
            setExporting(false);
        }
    };

    const statusItems = [
        ['Backup Format', 'JSON export'],
        ['Last Backup', formatBackupDate(lastBackup)],
        ['Server', 'http://localhost:5000'],
        ['Signed In As', currentUser.name || 'User'],
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '20px', alignItems: 'start' }}>
            <div style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '22px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '900', color: '#1a1a1a' }}>Database Backup</h3>
                <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#7A6A5D', lineHeight: 1.5 }}>
                    Export a backup file containing the current products, categories, inventory, transactions, and refunds.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                    {backupSources.map(source => (
                        <div key={source.key} style={{ border: '1px solid #E8DDD0', borderRadius: '8px', padding: '12px', backgroundColor: '#FAFAF8' }}>
                            <p style={{ margin: 0, fontSize: '12px', color: '#3D1F0D', fontWeight: '800' }}>{source.label}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#999' }}>Included</p>
                        </div>
                    ))}
                </div>

                {message && (
                    <div style={{
                        marginBottom: '16px',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        backgroundColor: message.type === 'success' ? '#F0FFF4' : '#FFF5F5',
                        color: message.type === 'success' ? '#276749' : '#C53030',
                        border: `1px solid ${message.type === 'success' ? '#C6F6D5' : '#FED7D7'}`,
                    }}>
                        {message.text}
                    </div>
                )}

                <button
                    onClick={handleExportBackup}
                    disabled={exporting}
                    style={{
                        width: '100%',
                        padding: '13px',
                        backgroundColor: exporting ? '#C4A87A' : '#8B5E3C',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: exporting ? 'not-allowed' : 'pointer',
                    }}
                >
                    {exporting ? 'Exporting Backup...' : 'Export Backup File'}
                </button>
            </div>

            <aside style={{ backgroundColor: '#F0E8E0', border: '1px solid #E0D5CB', borderRadius: '12px', padding: '18px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '900', color: '#3D1F0D' }}>System Info</h3>
                {statusItems.map(([label, value]) => (
                    <div key={label} style={{ padding: '10px 0', borderBottom: label === 'Signed In As' ? 'none' : '1px solid #E0D5CB' }}>
                        <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#8B5E3C', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{label}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#3D1F0D', fontWeight: '700', lineHeight: 1.4 }}>{value}</p>
                    </div>
                ))}
            </aside>
        </div>
    );
};

const MENU_ITEMS = [
    { key: 'inventory', label: 'PRODUCTS', adminOnly: true, group: 'products' },
    { key: 'addons', label: 'ADD-ONS', adminOnly: true, group: 'products' },
    { key: 'discounts', label: 'DISCOUNTS', adminOnly: true, group: 'products' },
    { key: 'users', label: 'CREATE ACCOUNT', adminOnly: true },
    { key: 'password', label: 'CHANGE PASSWORD' },
    { key: 'system', label: 'SYSTEM & BACKUP' },
    { key: 'about', label: 'ABOUT FLUX' },
];

const SettingsPage = ({ initialSection, mode = 'settings' }) => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = isAdminRole(currentUser.role);
    const pageMenuItems = useMemo(() => MENU_ITEMS.filter(item => (
        mode === 'products'
            ? item.group === 'products'
            : item.group !== 'products'
    )), [mode]);
    const visibleMenuItems = useMemo(() => (
        pageMenuItems.filter(item => isAdmin || !item.adminOnly)
    ), [pageMenuItems, isAdmin]);
    const getDefaultSection = useCallback(() => {
        const requestedSection = initialSection || visibleMenuItems[0]?.key || 'password';
        const requestedItem = pageMenuItems.find(item => item.key === requestedSection);
        return requestedItem && (isAdmin || !requestedItem.adminOnly) ? requestedSection : 'password';
    }, [initialSection, isAdmin, pageMenuItems, visibleMenuItems]);
    const [activeSection, setActiveSection] = useState(getDefaultSection);

    useEffect(() => {
        setActiveSection(getDefaultSection());
    }, [getDefaultSection]);

    useEffect(() => {
        if (!isAdmin && MENU_ITEMS.find(item => item.key === activeSection)?.adminOnly) {
            setActiveSection('password');
        }
    }, [activeSection, isAdmin]);

    const renderContent = () => {
        switch (activeSection) {
            case 'inventory': return isAdmin ? <InventorySettings /> : null;
            case 'addons': return isAdmin ? <AddonSettings /> : null;
            case 'discounts': return isAdmin ? <DiscountSettings /> : null;
            case 'users': return isAdmin ? <UserAccountSettings /> : null;
            case 'password': return <ChangePasswordSettings />;
            case 'system': return <SystemBackupSettings />;
            case 'about': return (
                <div style={{ marginTop: '20px', fontFamily: 'Segoe UI, sans-serif' }}>
                    <div style={{ width: '76px', height: '76px', borderRadius: '16px', backgroundColor: '#fff', border: '1px solid #E0D5CB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                        <img src="/logo192.png" alt="FLUX Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 8px' }}>FLUX</h3>
                    <p style={{ fontSize: '13px', color: '#888', margin: '0 0 4px' }}>Point-of-Sale & Inventory Management System</p>
                    <p style={{ fontSize: '13px', color: '#888', margin: '0 0 4px' }}>Built for Eli Coffee & Tea, Antipolo</p>
                    <p style={{ fontSize: '13px', color: '#8B5E3C', margin: '0', fontWeight: '600' }}>© 2026 CAPSTONE Inc.</p>
                </div>
            );
            default: return null;
        }
    };

    return (
        <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
            <Sidebar />

            <div className="mobile-page-content settings-mobile-content" style={{ flex: 1, overflow: 'auto', padding: '32px', display: 'flex', gap: '24px' }}>

                {/* Left Menu */}
                <div style={{ width: '220px', flexShrink: 0, backgroundColor: '#F0E8E0', borderRadius: '16px', padding: '24px 16px', height: 'fit-content' }}>
                    {visibleMenuItems.map(item => (
                        <button
                            key={item.key}
                            onClick={() => setActiveSection(item.key)}
                            style={{
                                width: '100%', textAlign: 'left', padding: '12px 14px',
                                border: 'none', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '13px', fontWeight: activeSection === item.key ? '800' : '600',
                                backgroundColor: activeSection === item.key ? '#8B5E3C' : 'transparent',
                                color: activeSection === item.key ? '#fff' : '#3D1F0D',
                                marginBottom: '4px', transition: 'all 0.15s',
                                letterSpacing: '0.3px',
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Right Content */}
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#1a1a1a', margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {visibleMenuItems.find(m => m.key === activeSection)?.label}
                    </h2>
                    {renderContent()}
                </div>

            </div>
        </div>
    );
};

export default SettingsPage;
