const beverageAddons = [
  'Ice Blended',
  'Cold brew Shot',
  'Whip Cream',
  'Milk',
  'Choco Kisses',
  'Cream Cheese',
  'Crushed Oreo',
  'Cheese Cake',
  'Nata',
];

const dessertAddons = [
  'Whip Cream',
  'Choco Kisses',
  'Cream Cheese',
  'Crushed Oreo',
  'Cheese Cake',
];

const presets = {
  drinks: {
    label: 'Drinks',
    variantGroups: [
      { name: 'Temperature', options: ['Hot', 'Iced'], optionPrices: [0, 0] },
      { name: 'Size', options: ['Regular', 'Large'], optionPrices: [0, 30] },
    ],
    addonNames: beverageAddons,
  },
  'main dish': {
    label: 'Main Dish',
    variantGroups: [
      {
        name: 'Flavor',
        options: ['Original', 'Garlic Parmesan', 'Garlic Mayo', 'Cheesy Cheese', 'Honey Glaze'],
        optionPrices: [0, 0, 0, 0, 0],
      },
    ],
    addonNames: [],
  },
  pastas: {
    label: 'Pastas',
    variantGroups: [
      { name: 'Portion', options: ['Solo', 'Platter'], optionPrices: [0, 0] },
    ],
    addonNames: [],
  },
  'salu salo set': {
    label: 'Salu-Salo Set',
    variantGroups: [
      { name: 'Set Size', options: ['Couple', 'Family'], optionPrices: [0, 0] },
    ],
    addonNames: [],
  },
  pizzas: {
    label: 'Pizzas',
    variantGroups: [
      { name: 'Crust', options: ['Regular', 'Thin Crust'], optionPrices: [0, 0] },
    ],
    addonNames: ['Cream Cheese'],
  },
  appetizer: {
    label: 'Appetizer',
    variantGroups: [
      { name: 'Dip', options: ['Ketchup', 'Garlic Mayo', 'Cheese'], optionPrices: [0, 0, 0] },
    ],
    addonNames: ['Cream Cheese'],
  },
  waffles: {
    label: 'Waffles',
    variantGroups: [
      { name: 'Topping', options: ['Plain', 'Caramel', 'Blueberry', 'Chocolate', 'Biscoff'], optionPrices: [0, 0, 0, 0, 0] },
    ],
    addonNames: dessertAddons,
  },
  tiramisu: {
    label: 'Tiramisu',
    variantGroups: [
      { name: 'Flavor', options: ['Classic', 'Oreo', 'Coffee', 'Matcha', 'Biscoff'], optionPrices: [0, 0, 0, 0, 0] },
    ],
    addonNames: dessertAddons,
  },
};

const categoryAliases = {
  drink: 'drinks',
  pasta: 'pastas',
  pizza: 'pizzas',
  waffle: 'waffles',
};

const normalizeCategoryKey = (category = '') => (
  String(category)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

export const getProductCategoryPreset = (category, availableAddons = []) => {
  const normalizedKey = normalizeCategoryKey(category);
  const key = categoryAliases[normalizedKey] || normalizedKey;
  const preset = presets[key];

  if (!preset) return null;

  const addonMap = new Map(
    availableAddons
      .filter(addon => addon?.name)
      .map(addon => [String(addon.name).trim().toLowerCase(), addon])
  );

  return {
    label: preset.label,
    variantGroups: preset.variantGroups.map(group => ({
      name: group.name,
      options: [...group.options],
      optionPrices: [...(group.optionPrices || group.options.map(() => 0))],
    })),
    addons: preset.addonNames
      .map(name => addonMap.get(name.toLowerCase()))
      .filter(Boolean)
      .map(addon => ({
        name: addon.name,
        price: Number(addon.price) || 0,
      })),
  };
};

