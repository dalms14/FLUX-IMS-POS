// Items.jsx
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FiAlertTriangle, FiChevronDown, FiChevronUp, FiPrinter, FiRefreshCw, FiImage, FiPlus, FiTag, FiX } from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import ReceiptViewModal from '../components/ReceiptViewModal';

const ALL_CATEGORY = 'ALL';
const CASHIER_SESSION_KEY = 'fluxCashierSession';
const ORDER_REFRESH_MS = 5000;
const VALID_CUSTOMER_TYPES = new Set(['customer', 'elite', 'pagibig', 'pwd_senior', 'custom_discount']);
const SERVICE_TYPES = ['Dine In', 'Dine Out'];
const SYSTEM_DISCOUNTS = [
  { name: 'Elite Member', percentage: 20 },
];
const DEFAULT_DISCOUNTS = [
  ...SYSTEM_DISCOUNTS,
  { name: 'Pag-IBIG', percentage: 20 },
  { name: 'PWD/Senior Citizen', percentage: 20 },
];

const normalizeDiscount = (discount) => {
  if (!discount?.name) return null;

  const percentage = Number(discount.percentage);
  if (!Number.isFinite(percentage) || percentage < 0) return null;

  const name = String(discount.name).trim();
  const key = name.toLowerCase();
  let code = 'custom_discount';

  if (key.includes('elite')) code = 'elite';
  else if (key.includes('pwd') || key.includes('senior')) code = 'pwd_senior';
  else if (key.includes('pag') || key.includes('ibig')) code = 'pagibig';

  return {
    _id: discount._id || '',
    name,
    percentage,
    code,
  };
};

const formatDiscountLabel = (discount) => (
  discount ? `${discount.name} ${Number(discount.percentage || 0).toLocaleString()}%` : ''
);

const findDiscountByCode = (discounts, code) => (
  discounts.find(discount => normalizeDiscount(discount)?.code === code)
);

const isSystemDiscount = (discount) => normalizeDiscount(discount)?.code === 'elite';

const toMoneyNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const orderMoney = (value) => `PHP ${(Number(value) || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

const orderStatusMeta = {
  pending: { label: 'Pending', color: '#975A16', bg: '#FFFAF0', border: '#FEEBC8' },
  preparing: { label: 'Preparing', color: '#2B6CB0', bg: '#EBF8FF', border: '#BEE3F8' },
  ready: { label: 'Ready', color: '#276749', bg: '#F0FFF4', border: '#C6F6D5' },
};

const getOrderActor = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      actor: user.name || user.email || 'System',
      actorEmail: user.email || '',
    };
  } catch {
    return { actor: 'System', actorEmail: '' };
  }
};

const formatOrderTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const getCartItemUnitPrice = (item) => toMoneyNumber(item?.price);

const getCartItemLineTotal = (item) => (
  getCartItemUnitPrice(item) * (Number(item?.quantity) || 0)
);

const getConfiguredProductPrice = (product, cartItem = {}) => {
  const basePrice = cartItem.size === 'platter'
    ? product.platterPrice
    : (product.soloPrice ?? product.price);
  const upgradeNames = new Set((cartItem.upgrades || []).map(upgrade => upgrade.name));
  const upgradesPrice = (product.addons || []).reduce((sum, addon) => (
    upgradeNames.has(addon.name) ? sum + toMoneyNumber(addon.price) : sum
  ), 0);

  return toMoneyNumber(basePrice) + upgradesPrice;
};

const sanitizeCartItem = (item) => ({
  _id: item._id,
  productId: item.productId,
  name: item.name,
  category: item.category,
  categoryId: item.categoryId,
  size: item.size,
  selectedVariant: item.selectedVariant,
  upgrades: item.upgrades || [],
  price: toMoneyNumber(item.price),
  quantity: Number(item.quantity) || 1,
  cartKey: item.cartKey,
  soloPrice: item.soloPrice,
  platterPrice: item.platterPrice,
});

const loadCashierSession = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CASHIER_SESSION_KEY) || '{}');
    const cart = Array.isArray(saved.cart)
      ? saved.cart.filter(item => item?.cartKey && item?.name).map(sanitizeCartItem)
      : [];
    let customerType = VALID_CUSTOMER_TYPES.has(saved.customerType) ? saved.customerType : 'customer';
    const eliteMember = saved.eliteMember || null;
    const discountApplied = Boolean(saved.discountApplied);
    const selectedDiscount = normalizeDiscount(saved.selectedDiscount);

    if ((customerType === 'elite' && (!eliteMember || !discountApplied)) ||
      (customerType !== 'customer' && !discountApplied)) {
      customerType = 'customer';
    }

    return {
      cart,
      customerType,
      eliteMember: customerType === 'elite' ? eliteMember : null,
      discountApplied: customerType !== 'customer' && discountApplied,
      selectedDiscount: customerType !== 'customer' ? selectedDiscount : null,
      discountEligibility: saved.discountEligibility && typeof saved.discountEligibility === 'object' ? saved.discountEligibility : {},
    };
  } catch {
    return {
      cart: [],
      customerType: 'customer',
      eliteMember: null,
      discountApplied: false,
      selectedDiscount: null,
      discountEligibility: {},
    };
  }
};

const buildProductStockStatus = (recipe) => {
  const ingredients = recipe?.ingredients || [];
  if (ingredients.length === 0) return { level: 'ok', label: '', details: [] };

  const shortageDetails = [];
  const lowDetails = [];

  ingredients.forEach(ingredient => {
    const source = ingredient.inventoryId || {};
    const stock = Number(source.stock ?? 0);
    const lowStockAt = Number(source.lowStockAt ?? 0);
    const required = Number(ingredient.amountPerServing || 0);
    const name = source.name || ingredient.name || 'Ingredient';
    const unit = source.unit || ingredient.unit || '';

    if (required > 0 && stock < required) {
      shortageDetails.push(`${name}: needs ${required} ${unit}, available ${stock} ${unit}`);
    } else if (stock > 0 && lowStockAt > 0 && stock <= lowStockAt) {
      lowDetails.push(`${name}: ${stock} ${unit} left, alert at ${lowStockAt} ${unit}`);
    }
  });

  if (shortageDetails.length > 0) {
    return { level: 'out', label: 'Unavailable', details: shortageDetails };
  }

  if (lowDetails.length > 0) {
    return { level: 'low', label: 'Low Stock', details: lowDetails };
  }

  return { level: 'ok', label: '', details: [] };
};

const vibrateCannotOrder = () => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([90, 40, 90]);
  }
};

// Add loading animation style
const styles = document.createElement('style');
styles.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes menuShimmer {
    0% { background-position: 120% 0; }
    100% { background-position: -120% 0; }
  }
  @keyframes softPulse {
    0%, 100% { opacity: 0.72; }
    50% { opacity: 1; }
  }
`;
document.head.appendChild(styles);

const skeletonShimmer = {
  background: 'linear-gradient(90deg, #EFE5DB 0%, #F8F2EC 44%, #EFE5DB 88%)',
  backgroundSize: '220% 100%',
  animation: 'menuShimmer 1.35s ease-in-out infinite',
};

const ProductGridLoading = () => (
  <>
    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px 0 4px', color: '#8B5E3C' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8B5E3C', animation: 'softPulse 1.2s ease-in-out infinite' }} />
      <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', letterSpacing: '0.4px' }}>Preparing menu...</p>
    </div>
    {Array.from({ length: 10 }).map((_, index) => (
      <div
        key={index}
        style={{
          backgroundColor: '#fff',
          border: '1px solid #E0D5CB',
          borderRadius: '8px',
          padding: '12px',
          minHeight: '292px',
          display: 'flex',
          flexDirection: 'column',
          gap: '11px',
          boxShadow: '0 4px 14px rgba(26,18,8,0.04)',
          overflow: 'hidden',
        }}
      >
        <div style={{ ...skeletonShimmer, width: '100%', aspectRatio: '4 / 3', borderRadius: '8px' }} />
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ ...skeletonShimmer, width: '76%', height: '16px', borderRadius: '6px' }} />
          <div style={{ ...skeletonShimmer, width: '42%', height: '10px', borderRadius: '6px' }} />
        </div>
        <div style={{ marginTop: 'auto', display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gap: '6px' }}>
            <div style={{ ...skeletonShimmer, width: '34px', height: '9px', borderRadius: '6px' }} />
            <div style={{ ...skeletonShimmer, width: '82px', height: '18px', borderRadius: '6px' }} />
          </div>
          <div style={{ ...skeletonShimmer, width: '100%', height: '36px', borderRadius: '8px' }} />
        </div>
      </div>
    ))}
  </>
);

const ProductCard = ({ product, onAdd }) => {
  const [hovered, setHovered] = useState(false);
  const [imageUrl, setImageUrl] = useState(product.image || '');
  const [imageLoaded, setImageLoaded] = useState(!!product.image);
  const hasOptions = Boolean(product.platterPrice || product.addons?.length > 0 || product.variants?.length > 0);
  const stockLevel = product.stockStatus?.level || 'ok';
  const isLowStock = stockLevel === 'low';
  const isUnavailable = stockLevel === 'out';
  const productCategory = product.category || product.categoryId?.name || 'Product';
  const accentColor = isUnavailable ? '#C53030' : isLowStock ? '#B7791F' : '#8B5E3C';
  const softAccent = isUnavailable ? '#FFF5F5' : isLowStock ? '#FFFAF0' : '#F7F2ED';
  const cardBorder = isUnavailable ? '#FEB2B2' : isLowStock ? '#F6D48B' : hovered ? '#B89475' : '#E0D5CB';
  const actionLabel = hasOptions ? 'Options' : 'Add';
  const soloPrice = product.soloPrice ?? product.price ?? 0;

  useEffect(() => {
    if (!imageLoaded && product._id) {
      axios
        .get(`http://localhost:5000/api/products/${product._id}`)
        .then(res => {
          setImageUrl(res.data.image || '');
          setImageLoaded(true);
        })
        .catch(() => {
          setImageLoaded(true);
        });
    }
  }, [imageLoaded, product._id]);

  return (
    <div
      onClick={() => onAdd(product)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#fff',
        border: `1px solid ${cardBorder}`,
        borderRadius: '8px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s ease, border-color 0.18s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '11px',
        minHeight: '292px',
        boxShadow: hovered ? `0 16px 34px ${isUnavailable ? 'rgba(197,48,48,0.16)' : isLowStock ? 'rgba(183,121,31,0.16)' : 'rgba(70,42,24,0.14)'}` : '0 4px 14px rgba(26,18,8,0.06)',
        position: 'relative',
        overflow: 'hidden',
        opacity: isUnavailable ? 0.92 : 1,
      }}
    >
      <div style={{
        width: '100%',
        aspectRatio: '4 / 3',
        backgroundColor: softAccent,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.28s ease',
              filter: isUnavailable ? 'grayscale(0.35)' : 'none',
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#B8A090', display: 'grid', justifyItems: 'center', gap: '6px' }}>
            <FiImage size={30} />
            <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.75 }}>LOADING IMAGE</div>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 56%, rgba(26,18,8,0.42) 100%)', opacity: imageUrl ? 1 : 0 }} />
        <span style={{
          position: 'absolute',
          left: '9px',
          bottom: '8px',
          padding: '4px 8px',
          borderRadius: '999px',
          backgroundColor: 'rgba(255,255,255,0.92)',
          color: accentColor,
          fontSize: '10px',
          fontWeight: '900',
          maxWidth: 'calc(100% - 18px)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {productCategory}
        </span>
      </div>

      <div style={{ display: 'grid', gap: '7px', flex: 1 }}>
        <div>
          <p style={{ fontSize: '15px', fontWeight: '900', color: '#111827', margin: '0 0 5px', lineHeight: 1.2, minHeight: '36px' }}>{product.name}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '22px' }}>
            {product.variants?.length > 0 && (
              <span style={{ padding: '4px 7px', borderRadius: '999px', backgroundColor: '#F3F4F6', color: '#6B7280', fontSize: '10px', fontWeight: '800' }}>
                {product.variants.length} variant{product.variants.length > 1 ? 's' : ''}
              </span>
            )}
            {product.addons?.length > 0 && (
              <span style={{ padding: '4px 7px', borderRadius: '999px', backgroundColor: '#F7F2ED', color: '#8B5E3C', fontSize: '10px', fontWeight: '800' }}>
                Add-ons
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'grid', gap: '9px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '10px', color: '#9B8A7A', fontWeight: '900', textTransform: 'uppercase' }}>Solo</p>
              <p style={{ fontSize: '18px', fontWeight: '950', color: '#8B5E3C', margin: 0, lineHeight: 1 }}>
                PHP {soloPrice.toLocaleString()}
              </p>
            </div>
            {product.platterPrice && (
              <div style={{ textAlign: 'right', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '10px', color: '#9B8A7A', fontWeight: '900', textTransform: 'uppercase' }}>Platter</p>
                <p style={{ fontSize: '12px', fontWeight: '900', color: '#7A6A5A', margin: 0, lineHeight: 1.1 }}>
                  PHP {product.platterPrice.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onAdd(product);
            }}
            style={{
              width: '100%',
              minHeight: '36px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: isUnavailable ? '#C53030' : '#1A1208',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              fontSize: '12px',
              fontWeight: '900',
              boxShadow: hovered ? '0 10px 18px rgba(26,18,8,0.16)' : 'none',
              transition: 'box-shadow 0.18s ease, transform 0.18s ease',
            }}
          >
            {isUnavailable ? <FiAlertTriangle size={14} /> : <FiPlus size={15} />}
            {isUnavailable ? 'Unavailable' : actionLabel}
          </button>
        </div>
      </div>

      {product.stockStatus?.label && (
        <span style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          padding: '6px 8px',
          borderRadius: '999px',
          backgroundColor: isUnavailable ? '#C53030' : '#B7791F',
          color: '#fff',
          fontSize: '10px',
          fontWeight: '900',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          boxShadow: '0 8px 18px rgba(0,0,0,0.16)',
        }}>
          {isUnavailable && <FiAlertTriangle size={12} />}
          {product.stockStatus.label}
        </span>
      )}
      {hovered && !isUnavailable && (
        <span style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '8px',
          border: `1px solid ${accentColor}`,
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
};
const ProductModal = ({ product, onConfirm, onClose }) => {
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0] ?? null);
  const [size, setSize] = useState('solo');
  const [selectedUpgrades, setSelectedUpgrades] = useState([]);

  const availableAddons = product.addons || [];
  const canUseUpgrades = availableAddons.length > 0;
  const basePrice = size === 'solo' ? (product.soloPrice ?? product.price) : product.platterPrice;
  const upgradesPrice = canUseUpgrades ? selectedUpgrades.reduce((sum, u) => sum + toMoneyNumber(u.price), 0) : 0;
  const finalPrice = toMoneyNumber(basePrice) + upgradesPrice;

  const toggleUpgrade = (upgrade) => {
    setSelectedUpgrades(prev =>
      prev.some(u => u.name === upgrade.name)
        ? prev.filter(u => u.name !== upgrade.name)
        : [...prev, upgrade]
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="mobile-modal-card" style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', width: '450px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 6px' }}>{product.name}</h3>
        {product.description && <p style={{ fontSize: '13px', color: '#999', margin: '0 0 24px', lineHeight: '1.6' }}>{product.description}</p>}

        <p style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Size</p>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
          {['solo', ...(product.platterPrice ? ['platter'] : [])].map(s => (
            <button key={s} onClick={() => setSize(s)} style={{ flex: 1, padding: '12px', border: `2px solid ${size === s ? '#8B5E3C' : '#eee'}`, borderRadius: '10px', backgroundColor: size === s ? '#FDF5EE' : '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: size === s ? '#8B5E3C' : '#999' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}<br />
              <span style={{ fontSize: '15px', fontWeight: '800' }}>PHP {s === 'solo' ? (product.soloPrice ?? product.price) : product.platterPrice}</span>
            </button>
          ))}
        </div>

        {product.variants?.length > 0 && (
          <>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Flavor</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {product.variants.map(v => (
                <button key={v} onClick={() => setSelectedVariant(v)} style={{ padding: '9px 16px', border: `2px solid ${selectedVariant === v ? '#8B5E3C' : '#eee'}`, borderRadius: '20px', backgroundColor: selectedVariant === v ? '#FDF5EE' : '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: selectedVariant === v ? '#8B5E3C' : '#999' }}>
                  {v}
                </button>
              ))}
            </div>
          </>
        )}

        {canUseUpgrades && (
          <>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Upgrades / Add-ons</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {availableAddons.map(u => {
                const isSelected = selectedUpgrades.some(su => su.name === u.name);
                return (
                  <button key={u.name} onClick={() => toggleUpgrade(u)} style={{ padding: '9px 16px', border: `2px solid ${isSelected ? '#8B5E3C' : '#eee'}`, borderRadius: '20px', backgroundColor: isSelected ? '#FDF5EE' : '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: isSelected ? '#8B5E3C' : '#999', transition: 'all 0.15s' }}>
                    {u.name} (+PHP {toMoneyNumber(u.price).toLocaleString()})
                  </button>
                );
              })}
            </div>
          </>
        )}

        <button onClick={() => onConfirm({ ...product, selectedVariant, size, price: finalPrice, upgrades: canUseUpgrades ? selectedUpgrades : [] })} style={{ width: '100%', padding: '14px', backgroundColor: '#8B5E3C', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
          Add to Order - PHP {finalPrice?.toLocaleString()}
        </button>
      </div>
    </div>
  );
};


// ── Main Items Page ──
const EliteVerificationModal = ({ onConfirm, onCancel }) => {
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #ddd', borderRadius: '8px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    marginTop: '6px',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div className="mobile-modal-card" style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '28px', width: '340px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        <h3 style={{ fontSize: '17px', fontWeight: '700', margin: '0 0 4px', color: '#1a1a1a' }}>Elite Membership Verification</h3>
        <div style={{ height: '2px', backgroundColor: '#1a1a1a', width: '100%', marginBottom: '20px' }} />
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>Name:</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Enter member name" />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>ID Number:</label>
          <input value={idNumber} onChange={e => setIdNumber(e.target.value)} style={inputStyle} placeholder="Enter card ID number" />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px', backgroundColor: '#E53E3E', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => {
              if (!name.trim() || !idNumber.trim()) { alert('Please fill in both Name and ID Number.'); return; }
              onConfirm({ name: name.trim(), idNumber: idNumber.trim() });
            }}
            style={{ flex: 1, padding: '12px', backgroundColor: '#38A169', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
          >Confirm</button>
        </div>
      </div>
    </div>
  );
};

const DiscountTypeModal = ({ discounts, onSelect, onCancel }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  
  const filteredDiscounts = discounts.filter(discount =>
    discount.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(discount.percentage).includes(searchQuery)
  );

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const modalWidth = isMobile ? '90vw' : 'min(420px, 90vw)';
  const maxModalHeight = isMobile ? '80vh' : '75vh';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div className="mobile-modal-card" style={{ 
        backgroundColor: '#fff', 
        borderRadius: '20px', 
        width: modalWidth,
        maxHeight: maxModalHeight,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        maxWidth: '100%',
      }}>
        {/* Header */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid #E0D5CB', flexShrink: 0 }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 12px', color: '#1a1a1a', letterSpacing: '0.5px' }}>
            Select Discount Type
          </h3>
          <div style={{ height: '2px', backgroundColor: '#1a1a1a', width: '100%', marginBottom: '16px' }} />
          
          {/* Search input - only show if there are many discounts */}
          {discounts.length > 4 && (
            <input
              type="text"
              placeholder="Search discounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1.5px solid #E0D5CB',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: '#FAFAF8',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        {/* Discount list - scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {filteredDiscounts.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '120px',
              color: '#999',
              fontSize: '13px',
              fontWeight: '700',
            }}>
              {searchQuery ? 'No matching discounts found.' : 'No discounts available.'}
            </div>
          ) : (
            filteredDiscounts.map(discount => (
              <button
                key={discount._id || discount.name}
                onClick={() => onSelect(discount)}
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#FDF5EE',
                  color: '#8B5E3C',
                  border: '2px solid #8B5E3C',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  minHeight: '48px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#F7EDE1';
                  e.target.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#FDF5EE';
                  e.target.style.transform = 'translateX(0)';
                }}
              >
                <div>
                  <div style={{ fontWeight: '800', marginBottom: '3px' }}>{discount.name}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#A06B43' }}>
                    {Number(discount.percentage || 0).toLocaleString()}% discount
                  </div>
                </div>
                <div style={{
                  backgroundColor: '#8B5E3C',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '800',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}>
                  {Number(discount.percentage || 0)}%
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer - Cancel button */}
        <div style={{
          padding: '16px 28px 28px',
          borderTop: '1px solid #E0D5CB',
          flexShrink: 0,
        }}>
          <button
            onClick={onCancel}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#E53E3E',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#C53030';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#E53E3E';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const compressGcashProof = async (file) => {
  const dataUrl = await fileToDataUrl(file);

  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 1200;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(dataUrl);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.76));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
};

const ReceiptModal = ({ cart, subtotal, discount, total, customerType, eliteMember, selectedDiscount, onConfirm, onCancel }) => {
  const [serviceType, setServiceType] = useState('Dine In');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [gcashProofImage, setGcashProofImage] = useState('');
  const [gcashProofName, setGcashProofName] = useState('');
  const [error, setError] = useState('');

  const change = paymentMethod === 'Cash' ? (parseFloat(amountTendered) || 0) - total : 0;
  const eligibleDiscountSubtotal = cart.reduce((sum, item) => (
    sum + (getCartItemUnitPrice(item) * Math.min(item.discountEligibleQuantity || 0, item.quantity || 0))
  ), 0);
  const discountLabel = formatDiscountLabel(selectedDiscount);
  const isPwdSeniorDiscount = selectedDiscount?.code === 'pwd_senior' || customerType === 'pwd_senior';

  const handleConfirm = () => {
    if (paymentMethod === 'Cash') {
      if (!amountTendered || parseFloat(amountTendered) < total) {
        setError(`Amount tendered must be at least PHP ${total.toLocaleString()}`);
        return;
      }
    }
    if (paymentMethod === 'GCash') {
      if (!amountTendered.trim()) {
        setError('Please enter the GCash reference number.');
        return;
      }
      if (amountTendered.trim().length < 10) {
        setError('Please enter a valid GCash reference number.');
        return;
      }
      const needsMobileProof = typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(max-width: 768px)').matches;
      if (needsMobileProof && !gcashProofImage) {
        setError('Please capture the GCash payment proof.');
        return;
      }
    }
    onConfirm({
      serviceType,
      paymentMethod,
      amountTendered: paymentMethod === 'Cash' ? parseFloat(amountTendered) : total,
      change: paymentMethod === 'Cash' ? Math.max(0, change) : 0,
      gcashReference: paymentMethod === 'GCash' ? amountTendered.trim() : null,
      gcashProofImage: paymentMethod === 'GCash' ? gcashProofImage || null : null,
    });
  };

  const handleGcashProofChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setGcashProofName(file.name || 'GCash proof');

    try {
      const compressedProof = await compressGcashProof(file);
      setGcashProofImage(compressedProof);
    } catch {
      setGcashProofImage('');
      setGcashProofName('');
      setError('Unable to read the GCash payment proof. Please try again.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div className="mobile-modal-card" style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', width: '420px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px dashed #eee', paddingBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 4px', letterSpacing: '1px' }}>FLUX - TRANSACTION SUMMARY</h2>
          <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>Eli Coffee & Tea, Antipolo</p>
          {eliteMember && (
            <div style={{ marginTop: '8px', padding: '4px 12px', backgroundColor: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: '20px', display: 'inline-block' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#276749', margin: 0 }}>Elite Member: {eliteMember.name}</p>
            </div>
          )}
          {!eliteMember && discountLabel && (
            <div style={{ marginTop: '8px', padding: '4px 12px', backgroundColor: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: '20px', display: 'inline-block' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#276749', margin: 0 }}>{discountLabel}</p>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          {cart.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px', gap: '12px' }}>
              <span style={{ color: '#333', flex: 1, paddingRight: '12px' }}>
                {item.quantity}x {item.name}
                {item.selectedVariant ? ` (${item.selectedVariant})` : ''}
                {' '} - {item.size === 'platter' ? 'Platter' : 'Solo'}
                {item.upgrades?.length > 0 ? <><br /><span style={{ fontSize: '11px', color: '#888' }}>+ {item.upgrades.map(u => u.name).join(', ')}</span></> : ''}
                {isPwdSeniorDiscount && item.discountEligibleQuantity > 0 ? <><br /><span style={{ fontSize: '11px', color: '#975A16', fontWeight: '700' }}>PWD/Senior discount qty: {item.discountEligibleQuantity}</span></> : ''}
              </span>
              <span style={{ fontWeight: '700', color: '#1a1a1a', flexShrink: 0 }}>PHP {getCartItemLineTotal(item).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px dashed #eee', paddingTop: '12px', marginBottom: '20px' }}>
          {[
            ['Subtotal', `PHP ${subtotal.toLocaleString()}`],
            ...(isPwdSeniorDiscount ? [['PWD/Senior eligible', `PHP ${eligibleDiscountSubtotal.toLocaleString()}`]] : []),
            [`Discount${discountLabel ? ` (${discountLabel})` : ''}`, discount > 0 ? `-PHP ${discount.toLocaleString()}` : 'PHP 0'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginBottom: '4px' }}>
              <span>{label}</span><span>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: '900', color: '#1a1a1a', marginTop: '8px' }}>
            <span>TOTAL</span><span>PHP {total.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Service Type</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {SERVICE_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => { setServiceType(type); setError(''); }}
                style={{ flex: 1, padding: '11px', border: `2px solid ${serviceType === type ? '#8B5E3C' : '#eee'}`, borderRadius: '10px', backgroundColor: serviceType === type ? '#FDF5EE' : '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: serviceType === type ? '#8B5E3C' : '#999' }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Payment Method</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['Cash', 'GCash'].map(method => (
              <button key={method} onClick={() => { setPaymentMethod(method); setAmountTendered(''); setGcashProofImage(''); setGcashProofName(''); setError(''); }}
                style={{ flex: 1, padding: '11px', border: `2px solid ${paymentMethod === method ? '#8B5E3C' : '#eee'}`, borderRadius: '10px', backgroundColor: paymentMethod === method ? '#FDF5EE' : '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: paymentMethod === method ? '#8B5E3C' : '#999' }}>
                {method}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod === 'Cash' && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>Amount Tendered</p>
            <input
              type="number" value={amountTendered}
              onChange={e => { setAmountTendered(e.target.value); setError(''); }}
              placeholder={`Minimum PHP ${total.toLocaleString()}`}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontWeight: '600' }}
            />
            {amountTendered && parseFloat(amountTendered) >= total && (
              <p style={{ fontSize: '13px', color: '#276749', fontWeight: '700', margin: '8px 0 0' }}>Change: PHP {Math.max(0, change).toLocaleString()}</p>
            )}
          </div>
        )}

        {paymentMethod === 'GCash' && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>GCash Reference Number</p>
            <input
              type="text" value={amountTendered}
              onChange={e => { setAmountTendered(e.target.value); setError(''); }}
              placeholder="e.g. 1234567890"
              maxLength={13}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontWeight: '600', letterSpacing: '2px' }}
            />
            <p style={{ fontSize: '11px', color: '#aaa', margin: '6px 0 0' }}>Enter the reference number from the GCash confirmation.</p>
            <div className="gcash-camera-capture" style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>Payment Proof</p>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', border: '2px dashed #8B5E3C', borderRadius: '10px', backgroundColor: '#FDF5EE', color: '#8B5E3C', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxSizing: 'border-box' }}>
                Use Camera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleGcashProofChange}
                  style={{ display: 'none' }}
                />
              </label>
              {gcashProofImage && (
                <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                  <img src={gcashProofImage} alt="GCash payment proof preview" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #E0D5CB' }} />
                  <p style={{ fontSize: '11px', color: '#6F4A2F', fontWeight: '700', margin: 0 }}>{gcashProofName || 'Payment proof captured'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: '12px', color: '#E53E3E', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => onCancel(serviceType)} style={{ flex: 1, padding: '13px', backgroundColor: '#f5f5f5', color: '#555', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleConfirm} style={{ flex: 2, padding: '13px', backgroundColor: '#8B5E3C', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            Confirm Order
          </button>
        </div>
      </div>
    </div>
  );
};

const OrderReasonModal = ({ mode, order, item, busy, onConfirm, onClose }) => {
  const defaultReason = mode === 'cancel'
    ? 'Customer cancelled before preparation'
    : 'Customer refunded item before preparation';
  const [reason, setReason] = useState(defaultReason);
  const [error, setError] = useState('');

  const title = mode === 'cancel' ? 'Cancel Order' : 'Refund Item';
  const summary = mode === 'cancel'
    ? `Order ${order?.orderNo || order?.receiptNo || ''}`
    : `${item?.name || 'Item'} x${item?.quantity || 0}`;
  const note = mode === 'cancel'
    ? 'This will cancel the pending order and record it in transaction history.'
    : 'This will remove the item from the pending order and mark it as refunded.';

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Please provide a reason.');
      return;
    }
    onConfirm(reason.trim());
  };

  if (!order) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,18,8,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3200, padding: '18px' }}>
      <div style={{ width: 'min(430px, 100%)', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 24px 64px rgba(0,0,0,0.24)', border: '1px solid #E8DDD0', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #F0E8E0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: '0 0 5px', color: '#8B5E3C', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{summary}</p>
              <h2 style={{ margin: 0, color: '#1a1a1a', fontSize: '20px', fontWeight: '950' }}>{title}</h2>
            </div>
            <button type="button" onClick={onClose} disabled={busy} title="Close" style={{ width: '32px', height: '32px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#8A7A6B', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FiX size={16} />
            </button>
          </div>
          <p style={{ margin: '10px 0 0', color: '#7A6A5A', fontSize: '12px', lineHeight: 1.45 }}>{note}</p>
        </div>

        <div style={{ padding: '18px 22px 20px' }}>
          <label style={{ display: 'block', marginBottom: '7px', color: '#6B5A4C', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Reason</label>
          <textarea
            value={reason}
            onChange={event => { setReason(event.target.value); setError(''); }}
            disabled={busy}
            rows={3}
            autoFocus
            style={{ width: '100%', resize: 'vertical', minHeight: '84px', padding: '11px 12px', border: '1.5px solid #D8CABB', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Segoe UI, sans-serif', fontSize: '13px', color: '#1a1a1a' }}
          />
          {error && <p style={{ margin: '8px 0 0', color: '#C53030', fontSize: '12px', fontWeight: '800' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button type="button" onClick={onClose} disabled={busy} style={{ flex: 1, minHeight: '42px', border: '1px solid #D4B89A', borderRadius: '8px', backgroundColor: '#fff', color: '#6F4A2F', fontSize: '13px', fontWeight: '900', cursor: busy ? 'not-allowed' : 'pointer' }}>Keep Order</button>
            <button type="button" onClick={handleConfirm} disabled={busy} style={{ flex: 1.35, minHeight: '42px', border: 'none', borderRadius: '8px', backgroundColor: busy ? '#D6D0C8' : '#C53030', color: '#fff', fontSize: '13px', fontWeight: '900', cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Saving...' : mode === 'cancel' ? 'Cancel Order' : 'Refund Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const orderActionStyle = (color, disabled) => ({
  flex: 1,
  minWidth: '92px',
  minHeight: '32px',
  padding: '8px 10px',
  border: 'none',
  borderRadius: '8px',
  backgroundColor: disabled ? '#D6D0C8' : color,
  color: '#fff',
  fontSize: '11px',
  fontWeight: '900',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
});

const ActiveOrderCard = ({ order, busy, onStatus, onCancel, onRemoveItem, onReceipt }) => {
  const status = order.orderStatus || 'pending';
  const meta = orderStatusMeta[status] || orderStatusMeta.pending;
  const itemCount = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const displayTotal = order.activeTotal ?? order.total;
  const refundedItems = order.cancelledItems || [];

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #E0D5CB', borderRadius: '8px', padding: '12px', display: 'grid', gap: '10px', boxShadow: '0 3px 12px rgba(26,18,8,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <p style={{ margin: '0 0 3px', fontSize: '10px', color: '#8B5E3C', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Order No</p>
          <h3 style={{ margin: 0, fontSize: '26px', lineHeight: 1, color: '#1a1a1a', fontWeight: '950' }}>{order.orderNo || '---'}</h3>
        </div>
        <span style={{ padding: '5px 8px', borderRadius: '999px', backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {meta.label}
        </span>
      </div>

      <div style={{ display: 'grid', gap: '5px', fontSize: '11px', color: '#6B5A4C', fontWeight: '700' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Slip</span><strong style={{ color: '#1a1a1a' }}>{order.receiptNo}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Service</span><strong style={{ color: '#1a1a1a' }}>{order.serviceType || 'Dine In'}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Items</span><strong style={{ color: '#1a1a1a' }}>{itemCount.toLocaleString()}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Total</span><strong style={{ color: '#8B5E3C' }}>{orderMoney(displayTotal)}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Created</span><strong style={{ color: '#1a1a1a' }}>{formatOrderTime(order.createdAt)}</strong></div>
      </div>

      <div style={{ borderTop: '1px solid #F0E8E0', paddingTop: '9px', display: 'grid', gap: '6px', maxHeight: '108px', overflowY: 'auto' }}>
        {(order.items || []).map((item, index) => (
          <div key={`${item.originalIndex ?? index}-${item.name}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '7px', fontSize: '11px', color: '#333' }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            <strong style={{ flexShrink: 0 }}>x{item.quantity}</strong>
            {status === 'pending' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemoveItem(order, item)}
                title={`Refund ${item.name}`}
                style={{ width: '22px', height: '22px', borderRadius: '6px', border: '1px solid #FED7D7', backgroundColor: '#FFF5F5', color: '#C53030', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <FiX size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {refundedItems.length > 0 && (
        <div style={{ borderTop: '1px solid #FED7D7', paddingTop: '8px', display: 'grid', gap: '5px' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#C53030', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Refunded</p>
          {refundedItems.map((item, index) => (
            <div key={`${item.refundId || index}-${item.name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: '#742A2A', fontWeight: '800' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              <span style={{ flexShrink: 0 }}>x{item.quantity}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
        {status === 'pending' && (
          <>
            <button type="button" disabled={busy} onClick={() => onStatus(order, 'preparing')} style={orderActionStyle('#2B6CB0', busy)}>Prepare</button>
            <button type="button" disabled={busy} onClick={() => onCancel(order)} style={orderActionStyle('#C53030', busy)}>Cancel</button>
          </>
        )}
        {status === 'preparing' && (
          <button type="button" disabled={busy} onClick={() => onStatus(order, 'ready')} style={orderActionStyle('#276749', busy)}>Ready</button>
        )}
        {status === 'ready' && (
          <>
            <button type="button" disabled={busy} onClick={() => onReceipt(order)} style={orderActionStyle('#2B6CB0', busy)}>
              <FiPrinter size={13} /> Receipt
            </button>
            <button type="button" disabled={busy} onClick={() => onStatus(order, 'completed')} style={orderActionStyle('#8B5E3C', busy)}>Complete</button>
          </>
        )}
      </div>
    </div>
  );
};

const ActiveOrdersBoard = ({ groupedOrders, loading, error, busyId, onRefresh, onStatus, onCancel, onRemoveItem, onReceipt }) => (
  <section style={{ marginBottom: '18px', border: '1px solid #E4D7CA', borderRadius: '8px', backgroundColor: '#F8F3EE', padding: '14px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      <div>
        <p style={{ fontSize: '11px', fontWeight: '900', color: '#8A7A6B', textTransform: 'uppercase', letterSpacing: '1.4px', margin: '0 0 3px' }}>Active Orders</p>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#1a1a1a', fontWeight: '900' }}>Pending, Preparing, Ready</h2>
      </div>
      <button type="button" onClick={onRefresh} style={{ minHeight: '34px', padding: '0 12px', border: 'none', borderRadius: '8px', backgroundColor: '#8B5E3C', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '900' }}>
        <FiRefreshCw size={14} /> Refresh
      </button>
    </div>

    {error && (
      <div style={{ padding: '10px 12px', border: '1px solid #FED7D7', borderRadius: '8px', backgroundColor: '#FFF5F5', color: '#C53030', fontSize: '12px', fontWeight: '800', marginBottom: '12px' }}>
        {error}
      </div>
    )}

    {loading ? (
      <div style={{ padding: '24px', textAlign: 'center', color: '#9B8A7A', fontSize: '13px', fontWeight: '800' }}>Loading active orders...</div>
    ) : (
      <div className="items-active-orders-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: '12px', alignItems: 'start' }}>
        {[
          ['pending', 'Pending'],
          ['preparing', 'Preparing'],
          ['ready', 'Ready'],
        ].map(([key, label]) => (
          <div key={key} style={{ display: 'grid', gap: '9px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#1a1a1a', fontWeight: '900' }}>{label}</h3>
              <span style={{ fontSize: '12px', fontWeight: '900', color: '#8B5E3C' }}>{groupedOrders[key].length}</span>
            </div>
            {groupedOrders[key].length === 0 ? (
              <div style={{ backgroundColor: '#fff', border: '1px dashed #D9C9BA', borderRadius: '8px', padding: '18px', textAlign: 'center', color: '#B8A090', fontSize: '12px', fontWeight: '800' }}>
                No {label.toLowerCase()} orders
              </div>
            ) : (
              groupedOrders[key].map(order => (
                <ActiveOrderCard
                  key={order._id}
                  order={order}
                  busy={busyId === order._id}
                  onStatus={onStatus}
                  onCancel={onCancel}
                  onRemoveItem={onRemoveItem}
                  onReceipt={onReceipt}
                />
              ))
            )}
          </div>
        ))}
      </div>
    )}
  </section>
);

const Items = () => {
  const [savedCashierSession] = useState(loadCashierSession);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [discounts, setDiscounts] = useState(DEFAULT_DISCOUNTS);
  const [cart, setCart] = useState(savedCashierSession.cart);
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerType, setCustomerType] = useState(savedCashierSession.customerType);
  const [showEliteModal, setShowEliteModal] = useState(false);
  const [showDiscountTypeModal, setShowDiscountTypeModal] = useState(false);
  const [eliteMember, setEliteMember] = useState(savedCashierSession.eliteMember);
  const [discountApplied, setDiscountApplied] = useState(savedCashierSession.discountApplied);
  const [selectedDiscount, setSelectedDiscount] = useState(savedCashierSession.selectedDiscount);
  const [discountEligibility, setDiscountEligibility] = useState(savedCashierSession.discountEligibility);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderBusyId, setOrderBusyId] = useState('');
  const [ordersError, setOrdersError] = useState('');
  const [posView, setPosView] = useState('items');
  const [orderReasonModal, setOrderReasonModal] = useState(null);
  const [categoryCollapsed, setCategoryCollapsed] = useState(false);

  const addNotification = useCallback((notice) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setNotifications(prev => [...prev, { id, ...notice }].slice(-4));
    window.setTimeout(() => {
      setNotifications(prev => prev.filter(item => item.id !== id));
    }, 8000);
  }, []);

  const normalizedDiscounts = useMemo(() => (
    [...SYSTEM_DISCOUNTS, ...(discounts.length > 0 ? discounts.filter(discount => !isSystemDiscount(discount)) : DEFAULT_DISCOUNTS.filter(discount => !isSystemDiscount(discount)))]
      .map(normalizeDiscount)
      .filter(Boolean)
  ), [discounts]);
  const availableDiscounts = useMemo(() => (
    normalizedDiscounts.filter(discount => discount.code !== 'elite')
  ), [normalizedDiscounts]);
  const activeDiscount = discountApplied
    ? (selectedDiscount || findDiscountByCode(normalizedDiscounts, customerType))
    : null;
  const activeDiscountLabel = formatDiscountLabel(activeDiscount);
  const isPwdSeniorDiscount = activeDiscount?.code === 'pwd_senior' || customerType === 'pwd_senior';
  const pwdSeniorDiscount = findDiscountByCode(normalizedDiscounts, 'pwd_senior');
  const canUseItemDiscount = customerType !== 'elite' && ((!discountApplied && Boolean(pwdSeniorDiscount)) || isPwdSeniorDiscount);

  const fetchActiveOrders = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/orders/active');
      setActiveOrders(res.data.orders || []);
      setOrdersError('');
    } catch (err) {
      console.error('Error loading active orders:', err);
      setOrdersError('Failed to load active orders.');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const groupedActiveOrders = useMemo(() => ({
    pending: activeOrders.filter(order => (order.orderStatus || 'pending') === 'pending'),
    preparing: activeOrders.filter(order => order.orderStatus === 'preparing'),
    ready: activeOrders.filter(order => order.orderStatus === 'ready'),
  }), [activeOrders]);

  const enrichProductStockStatus = useCallback(async (product) => {
    try {
      const recipeRes = await axios.get(`http://localhost:5000/api/products/${product._id}/recipe`);
      const recipe = recipeRes.data?.recipe;
      return {
        ...product,
        recipe,
        stockStatus: buildProductStockStatus(recipe),
      };
    } catch (err) {
      console.error('Error fetching product recipe:', err);
      return {
        ...product,
        stockStatus: product.stockStatus || { level: 'ok', label: '', details: [] },
      };
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const fetchDiscounts = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/discounts');
        const loadedDiscounts = (res.data.data || []).map(normalizeDiscount).filter(Boolean);
        if (alive && loadedDiscounts.length > 0) setDiscounts(loadedDiscounts);
      } catch (err) {
        console.error('Error fetching discounts:', err);
        if (alive) setDiscounts(DEFAULT_DISCOUNTS);
      }
    };

    fetchDiscounts();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    fetchActiveOrders();
    const timer = window.setInterval(fetchActiveOrders, ORDER_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchActiveOrders]);

  // Fetch products only (derive categories from products)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRes = await axios.get('http://localhost:5000/api/products');
        const enrichedProducts = await Promise.all((productsRes.data || []).map(enrichProductStockStatus));
        setProducts(enrichedProducts);
        setCart(prev => prev.map(cartItem => {
          const latestProduct = enrichedProducts.find(product => (
            product._id === cartItem._id || product._id === cartItem.productId
          ));
          if (!latestProduct) return sanitizeCartItem(cartItem);

          return {
            ...sanitizeCartItem(cartItem),
            name: latestProduct.name || cartItem.name,
            category: latestProduct.category || latestProduct.categoryId?.name || cartItem.category,
            categoryId: latestProduct.categoryId || cartItem.categoryId,
            price: getConfiguredProductPrice(latestProduct, cartItem),
            soloPrice: latestProduct.soloPrice,
            platterPrice: latestProduct.platterPrice,
          };
        }));

        // Derive categories from products and keep ALL as the first tab.
        const uniqueCategories = [...new Set(enrichedProducts.map(p => p.category || p.categoryId?.name).filter(Boolean))];
        const derivedCategories = [
          { name: ALL_CATEGORY, _id: 'all-products' },
          ...uniqueCategories
            .filter(name => String(name).toUpperCase() !== ALL_CATEGORY)
            .map(name => ({ name, _id: name }))
        ];
        setCategories(derivedCategories);
        setActiveCategory(ALL_CATEGORY);
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [enrichProductStockStatus]);

  useEffect(() => {
    if (!discountApplied || selectedDiscount || customerType === 'customer') return;

    const matchingDiscount = findDiscountByCode(normalizedDiscounts, customerType);
    if (matchingDiscount) setSelectedDiscount(matchingDiscount);
  }, [customerType, discountApplied, normalizedDiscounts, selectedDiscount]);

  useEffect(() => {
    if (!selectedDiscount) return;

    const latestDiscount = normalizedDiscounts.find(discount => (
      (selectedDiscount._id && discount._id === selectedDiscount._id) ||
      discount.name.toLowerCase() === selectedDiscount.name.toLowerCase()
    ));

    if (
      latestDiscount &&
      (latestDiscount.percentage !== selectedDiscount.percentage ||
        latestDiscount.name !== selectedDiscount.name ||
        latestDiscount.code !== selectedDiscount.code)
    ) {
      setSelectedDiscount(latestDiscount);
    }
  }, [normalizedDiscounts, selectedDiscount]);

  useEffect(() => {
    const validCartKeys = new Set(cart.map(item => item.cartKey));
    const cleanedEligibility = Object.fromEntries(
      Object.entries(discountEligibility)
        .filter(([cartKey]) => validCartKeys.has(cartKey))
        .map(([cartKey, quantity]) => {
          const item = cart.find(cartItem => cartItem.cartKey === cartKey);
          return [cartKey, Math.min(Number(quantity) || 0, item?.quantity || 0)];
        })
        .filter(([, quantity]) => quantity > 0)
    );

    localStorage.setItem(CASHIER_SESSION_KEY, JSON.stringify({
      cart: cart.map(sanitizeCartItem),
      customerType,
      eliteMember,
      discountApplied,
      selectedDiscount,
      discountEligibility: cleanedEligibility,
    }));
  }, [cart, customerType, eliteMember, discountApplied, discountEligibility, selectedDiscount]);

  const updateOrderStatus = async (order, status) => {
    setOrderBusyId(order._id);
    try {
      await axios.patch(`http://localhost:5000/api/orders/${order._id}/status`, {
        status,
        ...getOrderActor(),
      });
      await fetchActiveOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setOrderBusyId('');
    }
  };

  const cancelActiveOrder = (order) => {
    setOrderReasonModal({ mode: 'cancel', order });
  };

  const confirmCancelActiveOrder = async (order, reason) => {
    setOrderBusyId(order._id);
    try {
      await axios.post(`http://localhost:5000/api/orders/${order._id}/cancel`, {
        reason: reason.trim() || 'Order cancelled before preparation',
        ...getOrderActor(),
      });
      await fetchActiveOrders();
      setOrderReasonModal(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setOrderBusyId('');
    }
  };

  const openReadyOrderReceipt = (order) => {
    if ((order.orderStatus || 'pending') !== 'ready') return;

    setReceiptData({
      receiptNo: order.receiptNo,
      orderNo: order.orderNo,
      serviceType: order.serviceType,
      cart: (order.items || []).map(item => ({
        ...item,
        price: getCartItemUnitPrice(item),
        quantity: Number(item.quantity) || 0,
        discountEligibleQuantity: Number(item.discountEligibleQuantity) || 0,
      })),
      subtotal: order.activeSubtotal ?? order.subtotal,
      discount: order.activeDiscount ?? order.discount,
      total: order.activeTotal ?? order.total,
      paymentMethod: order.paymentMethod,
      amountTendered: order.amountTendered,
      change: order.change,
      gcashReference: order.gcashReference,
      gcashProofImage: order.gcashProofImage,
      cashier: order.cashier,
      customerType: order.customerType,
      eliteMember: order.eliteMember,
      selectedDiscount: order.discountInfo,
      createdAt: order.createdAt,
      closeLabel: 'Close Receipt',
    });
  };

  const removeActiveOrderItem = (order, item) => {
    setOrderReasonModal({ mode: 'refund-item', order, item });
  };

  const confirmRemoveActiveOrderItem = async (order, item, reason) => {
    setOrderBusyId(order._id);
    try {
      await axios.post(`http://localhost:5000/api/orders/${order._id}/cancel-items`, {
        items: [{
          originalIndex: item.originalIndex,
          quantity: item.quantity,
        }],
        reason: reason.trim() || 'Customer refunded item before preparation',
        ...getOrderActor(),
      });
      await fetchActiveOrders();
      setOrderReasonModal(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove item');
    } finally {
      setOrderBusyId('');
    }
  };

  const handleAddToCart = async (product) => {
    if (product.stockStatus?.level === 'out') {
      vibrateCannotOrder();
      addNotification({
        title: `${product.name} cannot be ordered`,
        message: 'One or more ingredients are out of stock or below the amount needed for one serving.',
        details: product.stockStatus.details || [],
      });
      return;
    }

    let latestProduct = product;

    try {
      const res = await axios.get(`http://localhost:5000/api/products/${product._id}`);
      latestProduct = await enrichProductStockStatus({ ...product, ...(res.data || {}) });
      setProducts(prev => prev.map(p => p._id === latestProduct._id ? { ...p, ...latestProduct } : p));
    } catch (err) {
      console.error('Error fetching latest product:', err);
    }

    if (latestProduct.stockStatus?.level === 'out') {
      vibrateCannotOrder();
      addNotification({
        title: `${latestProduct.name} cannot be ordered`,
        message: 'One or more ingredients are out of stock or below the amount needed for one serving.',
        details: latestProduct.stockStatus.details || [],
      });
      return;
    }

    if (latestProduct.addons?.length > 0 || latestProduct.variants?.length > 0 || latestProduct.platterPrice) {
      setSelectedProduct(latestProduct);
      return;
    }

    addToCart({
      ...latestProduct,
      selectedVariant: null,
      size: 'solo',
      price: latestProduct.soloPrice ?? latestProduct.price,
      upgrades: [],
    });
  };

  const addToCart = (item) => {
    const upgradeStr = item.upgrades?.length ? item.upgrades.map(u => u.name).sort().join(',') : '';
    const key = `${item._id}-${item.size}-${item.selectedVariant || ''}-${upgradeStr}`;
    setCart(prev => {
      const existing = prev.find(c => c.cartKey === key);
      if (existing) return prev.map(c => c.cartKey === key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, cartKey: key, quantity: 1 }];
    });
    setSelectedProduct(null);
  };

  const removeFromCart = (cartKey) => {
    setCart(prev => prev.filter(c => c.cartKey !== cartKey));
    setDiscountEligibility(prev => {
      const next = { ...prev };
      delete next[cartKey];
      return next;
    });
  };

  const updateQty = (cartKey, delta) => {
    setCart(prev => prev.map(c => {
      if (c.cartKey !== cartKey) return c;
      const newQty = c.quantity + delta;
      return newQty <= 0 ? null : { ...c, quantity: newQty };
    }).filter(Boolean));
    setDiscountEligibility(prev => {
      const item = cart.find(c => c.cartKey === cartKey);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      const next = { ...prev };
      if (newQty <= 0) {
        delete next[cartKey];
      } else if (next[cartKey]) {
        next[cartKey] = newQty;
      }
      return next;
    });
  };

  const clearCart = () => { setCart([]); setDiscountEligibility({}); setDiscountApplied(false); setSelectedDiscount(null); setEliteMember(null); setCustomerType('customer'); setShowDiscountTypeModal(false); setMobileCartOpen(false); };

  const handleCustomerTypeChange = (type) => {
    if (type === 'elite') { setShowEliteModal(true); setShowDiscountTypeModal(false); }
    else { setCustomerType('customer'); setEliteMember(null); setDiscountEligibility({}); setDiscountApplied(false); setSelectedDiscount(null); }
  };

  const handleEliteConfirm = (member) => {
    const eliteDiscount = findDiscountByCode(normalizedDiscounts, 'elite');

    setEliteMember(member);
    setCustomerType('elite');
    setSelectedDiscount(eliteDiscount);
    setDiscountEligibility({});
    setDiscountApplied(true);
    setShowEliteModal(false);
  };
  const handleApplyDiscount = () => {
    if (customerType === 'elite') return;
    if (discountApplied) {
      setCustomerType('customer');
      setDiscountEligibility({});
      setDiscountApplied(false);
      setSelectedDiscount(null);
      return;
    }
    setShowDiscountTypeModal(true);
  };
  const handleDiscountTypeSelect = (discountOption) => {
    const discountChoice = normalizeDiscount(discountOption);
    if (!discountChoice) return;

    setCustomerType(discountChoice.code);
    setSelectedDiscount(discountChoice);
    setEliteMember(null);
    if (discountChoice.code !== 'pwd_senior') setDiscountEligibility({});
    setDiscountApplied(true);
    setShowDiscountTypeModal(false);
  };
  const toggleDiscountEligibility = (cartKey) => {
    const item = cart.find(c => c.cartKey === cartKey);
    if (!item) return;

    setDiscountEligibility(prev => {
      const next = isPwdSeniorDiscount ? { ...prev } : {};
      if (next[cartKey]) delete next[cartKey];
      else next[cartKey] = item.quantity;
      return next;
    });
    const pwdDiscount = findDiscountByCode(normalizedDiscounts, 'pwd_senior');
    if (!pwdDiscount) {
      addNotification({
        title: 'PWD/Senior discount unavailable',
        message: 'Add a PWD/Senior discount in Products > Discounts before applying it to an item.',
        details: [],
      });
      return;
    }

    setCustomerType('pwd_senior');
    setSelectedDiscount(pwdDiscount);
    setEliteMember(null);
    setDiscountApplied(true);
    setShowDiscountTypeModal(false);
  };
  const subtotal = cart.reduce((acc, item) => acc + getCartItemLineTotal(item), 0);
  const eligibleDiscountSubtotal = cart.reduce((acc, item) => {
    const eligibleQuantity = Math.min(discountEligibility[item.cartKey] || 0, item.quantity);
    return acc + getCartItemUnitPrice(item) * eligibleQuantity;
  }, 0);
  const tax = 0; // VAT already included in product prices
  const discountBase = isPwdSeniorDiscount ? eligibleDiscountSubtotal : subtotal;
  const discountRate = discountApplied ? (Number(activeDiscount?.percentage) || 0) / 100 : 0;
  const discount = Math.round(discountBase * discountRate);
  const total = subtotal - discount;

  const filteredProducts = products.filter(p => {
    const productCategory = p.category || p.categoryId?.name;
    const matchesCategory = activeCategory === ALL_CATEGORY || productCategory === activeCategory;
    return matchesCategory && p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });
  const handleProceedToCheckout = () => {
    if (cart.length === 0) return;
    if (isPwdSeniorDiscount && discountApplied && eligibleDiscountSubtotal <= 0) {
      addNotification({
        title: 'Select discounted items',
        message: 'Set the PWD/Senior discount quantity for the eligible person before checkout.',
        details: [],
      });
      return;
    }
    setShowReceipt(true);
  };

  const buildTransactionItems = () => cart.map(item => ({
    productId: item._id,
    name: item.name,
    category: item.category,
    size: item.size,
    selectedVariant: item.selectedVariant,
    upgrades: item.upgrades,
    price: getCartItemUnitPrice(item),
    quantity: item.quantity,
    subtotal: getCartItemLineTotal(item),
    discountEligibleQuantity: isPwdSeniorDiscount ? Math.min(discountEligibility[item.cartKey] || 0, item.quantity) : item.quantity,
  }));

  const handleCancelCheckout = async (serviceType = 'Dine In') => {
    if (cart.length === 0) {
      setShowReceipt(false);
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    try {
      await axios.post('http://localhost:5000/api/transactions/cancelled-checkout', {
        cashier: user.name || 'Staff',
        cashierEmail: user.email || '',
        customerType,
        serviceType,
        eliteMember,
        items: buildTransactionItems(),
        subtotal,
        tax: 0,
        discount,
        total,
        discountInfo: activeDiscount ? {
          name: activeDiscount.name,
          percentage: activeDiscount.percentage,
          code: activeDiscount.code,
        } : null,
        reason: 'Checkout cancelled from transaction summary',
      });
      clearCart();
    } catch (err) {
      console.error('Error recording cancelled checkout:', err);
      addNotification({
        title: 'Cancellation was not recorded',
        message: err.response?.data?.message || 'The checkout was closed, but it could not be saved to transactions.',
        details: [],
      });
    } finally {
      setShowReceipt(false);
    }
  };

    const handleConfirmOrder = async ({ serviceType, paymentMethod, amountTendered, change, gcashReference, gcashProofImage }) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    try {
        await axios.post('http://localhost:5000/api/transactions', {
            cashier: user.name || 'Staff',
            cashierEmail: user.email || '',
            customerType, serviceType, eliteMember,
            items: buildTransactionItems(),
            subtotal, tax: 0, discount, total,
            discountInfo: activeDiscount ? {
              name: activeDiscount.name,
              percentage: activeDiscount.percentage,
              code: activeDiscount.code,
            } : null,
            paymentMethod, amountTendered, change,
            gcashReference: gcashReference || null,
            gcashProofImage: gcashProofImage || null,
        });
        fetchActiveOrders();
        setShowReceipt(false);
        clearCart();
        setPosView('orders');
    } catch (err) {
        if (err.response?.data?.code === 'INSUFFICIENT_STOCK') {
            const shortages = err.response.data.shortages || [];

            setShowReceipt(false);
            addNotification({
                title: 'Order cannot be processed',
                message: 'Not enough inventory for one or more ingredients.',
                details: shortages.map(item => {
                    const products = item.products?.length ? item.products.join(', ') : 'Selected product';
                    return `${products} - ${item.name}: needs ${item.required} ${item.unit}, available ${item.available} ${item.unit}`;
                }),
            });
            return;
        }

        addNotification({
            title: 'Order failed',
            message: err.response?.data?.message || 'Failed to save order. Please try again.',
            details: [],
        });
    }
};

  return (
    <div className="items-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      {notifications.length > 0 && (
        <div className="items-notification-stack" style={{
          position: 'fixed',
          top: '22px',
          right: '22px',
          width: '360px',
          maxWidth: 'calc(100vw - 44px)',
          zIndex: 3000,
          display: 'grid',
          gap: '10px',
        }}>
          {notifications.map(notification => (
            <div key={notification.id} className="items-notification" style={{
              backgroundColor: '#FFF5F5',
              border: '1.5px solid #FEB2B2',
              borderLeft: '5px solid #C53030',
              borderRadius: '8px',
              boxShadow: '0 18px 42px rgba(26,18,8,0.18)',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: '#9B2C2C', fontSize: '14px', fontWeight: '900' }}>{notification.title}</p>
                  <p style={{ margin: '5px 0 0', color: '#5C2A2A', fontSize: '12px', lineHeight: 1.45 }}>{notification.message}</p>
                </div>
                <button
                  onClick={() => setNotifications(prev => prev.filter(item => item.id !== notification.id))}
                  title="Close notification"
                  style={{
                    width: '24px',
                    height: '24px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(197,48,48,0.08)',
                    color: '#9B2C2C',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '800',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  x
                </button>
              </div>
              {notification.details?.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #FED7D7' }}>
                  {notification.details.map(detail => (
                    <p key={detail} style={{ margin: '0 0 4px', color: '#742A2A', fontSize: '12px', fontWeight: '700', lineHeight: 1.45 }}>
                      {detail}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Sidebar />

      {/* Main Content */}
      <div className="items-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', padding: '5px', border: '1px solid #E4D7CA', borderRadius: '8px', backgroundColor: '#F8F3EE', gap: '5px' }}>
            {[
              ['items', 'POS Items'],
              ['orders', 'Active Orders'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPosView(key)}
                style={{
                  minHeight: '36px',
                  padding: '0 16px',
                  border: 'none',
                  borderRadius: '7px',
                  backgroundColor: posView === key ? '#8B5E3C' : 'transparent',
                  color: posView === key ? '#fff' : '#6F5E4D',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '900',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {posView === 'orders' ? (
          <ActiveOrdersBoard
            groupedOrders={groupedActiveOrders}
            loading={ordersLoading}
            error={ordersError}
            busyId={orderBusyId}
            onRefresh={fetchActiveOrders}
            onStatus={updateOrderStatus}
            onCancel={cancelActiveOrder}
            onRemoveItem={removeActiveOrderItem}
            onReceipt={openReadyOrderReceipt}
          />
        ) : (
          <>
        {/* Category Tabs */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => setCategoryCollapsed(prev => !prev)}
              aria-expanded={!categoryCollapsed}
              style={{
                minHeight: '30px',
                padding: '0 10px',
                border: '1px solid #E4D7CA',
                borderRadius: '8px',
                backgroundColor: '#fff',
                color: '#6F5E4D',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.4px' }}>
                {categoryCollapsed ? `Category: ${activeCategory || ALL_CATEGORY}` : 'Category'}
              </span>
              {categoryCollapsed ? <FiChevronDown size={14} /> : <FiChevronUp size={14} />}
            </button>
            <span style={{ height: '1px', flex: 1, backgroundColor: '#E5D9CC' }} />
          </div>
          {!categoryCollapsed && (
            <div
              className="items-category-tabs"
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                padding: '6px',
                border: '1px solid #E4D7CA',
                borderRadius: '12px',
                backgroundColor: '#F8F3EE',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
              }}
            >
              {categories.map(cat => (
                <button key={cat._id ?? cat.name} onClick={() => setActiveCategory(cat.name)}
                  style={{
                    minHeight: '38px',
                    padding: '0 18px',
                    border: activeCategory === cat.name ? '1px solid #8B5E3C' : '1px solid transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '850',
                    backgroundColor: activeCategory === cat.name ? '#8B5E3C' : 'transparent',
                    color: activeCategory === cat.name ? '#fff' : '#6F5E4D',
                    transition: 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: activeCategory === cat.name ? '0 8px 18px rgba(139,94,60,0.18)' : 'none',
                  }}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items Header + Search */}
        <div className="items-header-search" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <p style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', margin: 0 }}>Items</p>
          <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '10px 18px', border: '1.5px solid #ddd', borderRadius: '24px', fontSize: '14px', outline: 'none', backgroundColor: '#fff', width: '200px' }} />
        </div>

        {/* Product Grid */}
        <div className="items-product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', overflowY: 'auto', flex: 1, paddingBottom: '16px', alignContent: 'start' }}>
          {loading ? (
            <ProductGridLoading />
          ) : filteredProducts.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#bbb', marginTop: '60px', fontSize: '15px' }}>No products found.</div>
          ) : (
            filteredProducts.map(product => <ProductCard key={product._id} product={product} onAdd={handleAddToCart} />)
          )}
        </div>
          </>
        )}
      </div>

      {/* Order Summary */}
      <button
        type="button"
        className="items-mobile-cart-button"
        onClick={() => setMobileCartOpen(true)}
      >
        <span>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
        <strong>Cart - PHP {total.toLocaleString()}</strong>
      </button>

      <div
        className={`items-mobile-cart-backdrop ${mobileCartOpen ? 'open' : ''}`}
        onClick={() => setMobileCartOpen(false)}
      />

      <div className={`items-order-summary ${mobileCartOpen ? 'mobile-cart-open' : ''}`} style={{ width: '300px', backgroundColor: '#fff', borderLeft: '1px solid #E0D5CB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #eee', textAlign: 'center', position: 'relative' }}>
          <p style={{ fontSize: '16px', fontWeight: '800', margin: 0, letterSpacing: '1px' }}>FLUX — CASHIER</p>
          <button
            type="button"
            className="items-mobile-cart-close"
            onClick={() => setMobileCartOpen(false)}
            aria-label="Close cart"
          >
            x
          </button>
          {eliteMember && (
            <div style={{ marginTop: '6px', padding: '4px 12px', backgroundColor: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: '20px', display: 'inline-block' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#276749', margin: 0 }}>✓ Member: {eliteMember.name}</p>
            </div>
          )}
          {!eliteMember && activeDiscountLabel && (
            <div style={{ marginTop: '6px', padding: '4px 12px', backgroundColor: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: '20px', display: 'inline-block' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#276749', margin: 0 }}>{activeDiscountLabel}</p>
            </div>
          )}
        </div>

        {/* Customer Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
          {[['customer', 'Customer'], ['elite', 'Elite Member']].map(([type, label]) => (
            <button key={type} onClick={() => handleCustomerTypeChange(type)}
              style={{ flex: 1, padding: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', backgroundColor: customerType === type ? '#8B5E3C' : '#F5F0EB', color: customerType === type ? '#fff' : '#7A6A5A', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {cart.length === 0
            ? <p style={{ textAlign: 'center', color: '#ccc', fontSize: '13px', marginTop: '32px' }}>No items added yet.</p>
            : cart.map(item => (
              <div key={item.cartKey} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', margin: 0 }}>{item.quantity}x {item.name}</p>
                  <p style={{ fontSize: '11px', color: '#aaa', margin: '2px 0 6px', lineHeight: '1.4' }}>
                    {item.size === 'platter' ? 'Platter' : 'Solo'}
                    {item.selectedVariant ? ` · ${item.selectedVariant}` : ''}
                    {item.upgrades?.length > 0 ? <><br/>+ {item.upgrades.map(u => u.name).join(', ')}</> : ''}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => updateQty(item.cartKey, -1)} style={{ width: '22px', height: '22px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#f9f9f9', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontSize: '13px', fontWeight: '600', minWidth: '16px', textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.cartKey, 1)} style={{ width: '22px', height: '22px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#f9f9f9', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#8B5E3C', margin: '0 0 4px' }}>₱{getCartItemLineTotal(item).toLocaleString()}</p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                    {canUseItemDiscount && (
                    <button
                      onClick={() => toggleDiscountEligibility(item.cartKey)}
                      title={discountEligibility[item.cartKey] ? 'Remove PWD/Senior discount from this item' : 'Apply PWD/Senior discount to this item'}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: `1px solid ${discountEligibility[item.cartKey] ? '#D97706' : '#E0D5CB'}`,
                        backgroundColor: discountEligibility[item.cartKey] ? '#FFFAF0' : '#fff',
                        color: discountEligibility[item.cartKey] ? '#D97706' : '#8A7A6B',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FiTag size={13} />
                    </button>
                    )}
                    <button onClick={() => removeFromCart(item.cartKey)} style={{ fontSize: '11px', color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Totals */}
        <div style={{ borderTop: '1px solid #eee', padding: '14px', backgroundColor: '#FAFAFA' }}>
          {[['Subtotal:', `₱${subtotal.toLocaleString()}`],
          ...(isPwdSeniorDiscount && discountApplied ? [['PWD/Senior eligible:', `₱${eligibleDiscountSubtotal.toLocaleString()}`]] : []),
          [`Discount${activeDiscountLabel ? ` (${activeDiscountLabel})` : ''}:`, discount > 0 ? `-₱${discount.toLocaleString()}` : '₱0.00']]
          .map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginBottom: '5px' }}>
              <span>{label}</span><span style={{ color: label.includes('Discount') && discount > 0 ? '#E53E3E' : '#666' }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '800', color: '#1a1a1a', margin: '8px 0 14px' }}>
            <span>TOTAL:</span><span>₱{total.toLocaleString()}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <button onClick={handleApplyDiscount} style={{ padding: '11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', backgroundColor: discountApplied ? '#276749' : '#38A169', color: '#fff' }}>{discountApplied ? 'Discount ✓' : 'Apply Discount'}</button>
            <button onClick={clearCart} style={{ padding: '11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', backgroundColor: '#E53E3E', color: '#fff' }}>Clear</button>
          </div>
          <button onClick={handleProceedToCheckout} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: 'none', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '700', backgroundColor: cart.length === 0 ? '#ccc' : '#38A169', color: '#fff' }}>Proceed to Checkout</button>
        </div>
      </div>

      {selectedProduct && <ProductModal product={selectedProduct} onConfirm={addToCart} onClose={() => setSelectedProduct(null)} />}
      {showEliteModal && <EliteVerificationModal onConfirm={handleEliteConfirm} onCancel={() => { setShowEliteModal(false); setCustomerType('customer'); setEliteMember(null); setDiscountEligibility({}); setDiscountApplied(false); setSelectedDiscount(null); }} />}
      {showDiscountTypeModal && <DiscountTypeModal discounts={availableDiscounts} onSelect={handleDiscountTypeSelect} onCancel={() => setShowDiscountTypeModal(false)} />}
      {orderReasonModal && (
        <OrderReasonModal
          mode={orderReasonModal.mode}
          order={orderReasonModal.order}
          item={orderReasonModal.item}
          busy={orderBusyId === orderReasonModal.order?._id}
          onClose={() => setOrderReasonModal(null)}
          onConfirm={(reason) => {
            if (orderReasonModal.mode === 'cancel') {
              confirmCancelActiveOrder(orderReasonModal.order, reason);
            } else {
              confirmRemoveActiveOrderItem(orderReasonModal.order, orderReasonModal.item, reason);
            }
          }}
        />
      )}

      {showReceipt && (
    <ReceiptModal cart={cart.map(item => ({
          ...item,
          discountEligibleQuantity: isPwdSeniorDiscount ? Math.min(discountEligibility[item.cartKey] || 0, item.quantity) : item.quantity,
        }))} subtotal={subtotal} tax={tax} discount={discount} total={total}
        customerType={customerType} eliteMember={eliteMember} selectedDiscount={activeDiscount}
        onConfirm={handleConfirmOrder} onCancel={handleCancelCheckout} />
      )}
      {receiptData && (
        <ReceiptViewModal
            {...receiptData}
            onClose={() => setReceiptData(null)}
        />
    )}
    </div>
  );
};

export default Items;
