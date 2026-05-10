# FLUX - Project Structure

## Organized Architecture

```
src/
├── pages/
│   ├── auth/
│   │   ├── LoginPage.jsx          (Sign in)
│   │   ├── ForgotPasswordPage.jsx  (Password recovery)
│   │   └── ChangePasswordPage.jsx  (Change password)
│   ├── dashboard/
│   │   ├── Dashboard.jsx           (Main dashboard)
│   │   ├── Items.jsx               (POS ordering system)
│   │   └── History.jsx             (Transaction history)
│   ├── inventory/
│   │   └── InventoryPage.jsx       (Inventory management)
│   └── settings/
│       └── SettingsPage.jsx        (Products & system settings)
│
├── components/
│   ├── layouts/
│   │   ├── Sidebar.jsx             (Navigation sidebar)
│   │   └── index.js                (Layout exports)
│   ├── modals/
│   │   ├── ReceiptViewModal.jsx    (Receipt display)
│   │   ├── ProfileModal.jsx        (User profile)
│   │   └── index.js                (Modal exports)
│   ├── common/
│   │   ├── ProductCard.jsx         (Product display card)
│   │   ├── CategoryList.jsx        (Category selector)
│   │   ├── PinPad.jsx              (PIN input component)
│   │   ├── PinDisplay.jsx          (PIN display)
│   │   └── index.js                (Common exports)
│   └── Navbar.jsx                  (Top navigation)
│
├── api/
│   └── (API service files - to be created)
│
├── App.js                          (Main app & routing)
├── App.css                         (Global styles)
├── index.js                        (Entry point)
└── index.css                       (Global CSS)
```

## File Organization Status

### ✅ Pages to Keep in `/pages/`
- LoginPage.jsx → Move to `/pages/auth/`
- ForgotPasswordPage.jsx → Move to `/pages/auth/`
- ChangePasswordPage.jsx → Move to `/pages/auth/`
- Dashboard.jsx → Move to `/pages/dashboard/`
- Items.jsx → Move to `/pages/dashboard/`
- InventoryPage.jsx → Move to `/pages/inventory/`
- SettingsPage.jsx → Move to `/pages/settings/`

### ✅ Components to Keep in `/components/`
- Sidebar.jsx → Move to `/components/layouts/`
- Navbar.jsx → Keep in `/components/`
- ProductCard.jsx → Move to `/components/common/`
- CategoryList.jsx → Move to `/components/common/`
- PinPad.jsx → Move to `/components/common/`
- PinDisplay.jsx → Move to `/components/common/`
- ReceiptViewModal.jsx → Move to `/components/modals/`
- ProfilePage.jsx → Rename to ProfileModal.jsx & Move to `/components/modals/`
- HistoryPage.jsx → Rename to History.jsx & Move to `/pages/dashboard/`

### ❌ Duplicates to Remove
- Settings.jsx (remove - use SettingsPage.jsx)
- AddProductPage.jsx (remove - feature moved to SettingsPage)
- PinPage.jsx (remove - PIN login removed)
- Login.jsx (remove - use LoginPage.jsx)
