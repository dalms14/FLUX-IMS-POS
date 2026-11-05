import React, { useState } from 'react';
import './RecipeOptionRules.css';

const keyOf = condition => JSON.stringify([condition.type, condition.group || '', condition.option]);
export const recipeChoices = (groups, addons, platter) => [
    ...groups.flatMap(group => group.options.filter(Boolean).map(option => ({ type: 'variant', group: group.name, option }))),
    ...addons.map(addon => ({ type: 'addon', option: addon.name })),
    { type: 'portion', option: 'solo' },
    ...(platter ? [{ type: 'portion', option: 'platter' }] : []),
];

export function recipeError(ingredients, rules, choices) {
    const valid = (value, zero = false, max = 1000000) => String(value).trim() !== '' && Number.isFinite(Number(value))
        && Number(value) >= (zero ? 0 : 0.001) && Number(value) <= max
        && Math.abs(Number(value) * 1000 - Math.round(Number(value) * 1000)) < 0.00001;
    const rowsValid = (rows, zero) => rows.every(row => row.inventoryId && valid(row.amountPerServing, zero) && valid(row.platterMultiplier, false, 1000));
    if (!rowsValid(ingredients, false)) return 'Enter positive ingredient amounts and platter multipliers, with up to three decimal places.';
    const seen = new Set();
    for (const rule of rules) {
        if (!rule.conditions.length || rule.conditions.some(condition => !choices.some(choice => keyOf(choice) === keyOf(condition)))) return 'Choose an available option for every ingredient rule.';
        const fields = rule.conditions.map(c => c.type === 'variant' ? `variant:${c.group}` : c.type === 'addon' ? `addon:${c.option}` : 'portion');
        if (new Set(fields).size !== fields.length) return 'Choose each variant group or add-on only once per rule.';
        const key = JSON.stringify([rule.mode, rule.conditions.map(keyOf).sort()]);
        if (seen.has(key)) return 'Combine duplicate option rules into one ingredient list.';
        seen.add(key);
        if (!rule.ingredients.length || !rowsValid(rule.ingredients, rule.mode === 'replace')) return 'Add ingredients and valid amounts to every rule. Only replacement amounts may be zero.';
    }
    return '';
}

const inputStyle = { padding: '9px 10px', border: '1px solid #ddd', borderRadius: 6, minWidth: 0, maxWidth: '100%', font: 'inherit' };
const buttonStyle = { ...inputStyle, background: '#fff', color: '#805737', cursor: 'pointer' };
const optionLabel = choice => `${choice.group || (choice.type === 'addon' ? 'Add-on' : 'Serving')}: ${choice.option === 'solo' ? 'Solo' : choice.option === 'platter' ? 'Platter' : choice.option}`;

function RecipeEntry({ rule, index, update, remove, inventory, choices }) {
    const [search, setSearch] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const availableIngredients = inventory
        .filter(item => !item.archived && !rule.ingredients.some(row => row.inventoryId === item._id)
            && `${item.name} ${item.unit} ${item.category || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
    const changeCondition = (ci, value) => {
        const selected = choices.find(choice => keyOf(choice) === value) || {};
        update({ conditions: rule.conditions.map((c, i) => i === ci ? selected : c),
            ...(ci === 0 ? { mode: selected.type === 'addon' ? 'add' : 'replace' } : {}) });
    };
    const changeAmount = (ri, field, value) => update({ ingredients: rule.ingredients.map((row, i) => i === ri ? { ...row, [field]: value } : row) });
    const selectOption = (condition, ci) => <select data-required-missing={!condition.option || !choices.some(choice => keyOf(choice) === keyOf(condition))} data-validation-message="Choose an available option for every ingredient rule." aria-label={`Rule ${index + 1} option ${ci + 1}`} style={{ ...inputStyle, width: '100%' }} value={keyOf(condition)} onChange={e => changeCondition(ci, e.target.value)}>
        <option value={keyOf({})}>Choose a size, variant or add-on...</option>
        {!choices.some(choice => keyOf(choice) === keyOf(condition)) && condition.option && <option value={keyOf(condition)}>Unavailable: {condition.option}</option>}
        {choices.map(choice => <option key={keyOf(choice)} value={keyOf(choice)}>{optionLabel(choice)}</option>)}
    </select>;
    return <div style={{ border: '1px solid #e4d8ce', borderRadius: 8, padding: 16, marginBottom: 12, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong>1. When this is selected</strong>
            <button type="button" style={{ ...buttonStyle, padding: '4px 8px' }} onClick={remove}>Remove</button>
        </div>
        {selectOption(rule.conditions[0] || {}, 0)}
        <div style={{ margin: '12px 0', display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
            <label><input type="radio" name={`recipe-mode-${index}`} checked={rule.mode === 'replace'} onChange={() => update({ mode: 'replace' })} /> Change the usual amount</label>
            <label><input type="radio" name={`recipe-mode-${index}`} checked={rule.mode === 'add'} onChange={() => update({ mode: 'add' })} /> Add an extra amount</label>
        </div>
        <strong style={{ display: 'block', marginBottom: 8 }}>2. Choose ingredients</strong>
        <div className="recipe-ingredient-picker">
            <button type="button" className="recipe-ingredient-trigger" data-required-missing={!rule.ingredients.length} data-validation-message="Select an ingredient for this recipe." aria-expanded={pickerOpen} onClick={() => { setPickerOpen(!pickerOpen); setSearch(''); }}>
                <span>+ Select ingredient</span><span aria-hidden="true">{pickerOpen ? '\u25b4' : '\u25be'}</span>
            </button>
            {pickerOpen && <div className="recipe-ingredient-panel">
                <div className="recipe-ingredient-search">
                    <input autoFocus aria-label={`Search ingredients for rule ${index + 1}`} placeholder="Search ingredient name..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setPickerOpen(false); }} />
                    {search && <button type="button" aria-label="Clear ingredient search" onClick={() => setSearch('')}>Clear</button>}
                </div>
                <div className="recipe-ingredient-list-heading"><span>{availableIngredients.length} ingredient{availableIngredients.length !== 1 ? 's' : ''}</span><span>A&ndash;Z</span></div>
                <div className="recipe-ingredient-list" role="group" aria-label={`Available ingredients for recipe ${index + 1}`}>
                    {availableIngredients.map(source => <button type="button" key={source._id} className="recipe-ingredient-choice" aria-label={`Add ${source.name} (${source.unit})`} onClick={() => {
                        update({ ingredients: [...rule.ingredients, { inventoryId: source._id, name: source.name, unit: source.unit, amountPerServing: '', platterMultiplier: 3 }] });
                        setPickerOpen(false);
                        setSearch('');
                    }}><span>{source.name}</span><span className="recipe-ingredient-unit">{source.unit}</span></button>)}
                    {!availableIngredients.length && <p className="recipe-ingredient-empty">{search ? 'No ingredients match your search.' : 'All available ingredients have been added.'}</p>}
                </div>
            </div>}
        </div>
        {rule.ingredients.length > 0 && <>
            <strong>3. Enter {rule.mode === 'add' ? 'the extra' : 'the new'} amount per solo serving</strong>
            <p style={{ margin: '5px 0 10px', color: '#777', fontSize: 12 }}>{rule.mode === 'add' ? 'This is added to the usual recipe.' : 'This replaces the usual amount for each ingredient below. Use 0 to leave it out.'}</p>
            {rule.ingredients.map((row, ri) => <div key={row.inventoryId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ flex: 1 }}>{row.name}</span>
                <input required aria-label={`${row.name} rule amount`} style={{ ...inputStyle, width: 95 }} type="number" min={rule.mode === 'replace' ? 0 : 0.001} max="1000000" step="0.001" value={row.amountPerServing} onChange={e => changeAmount(ri, 'amountPerServing', e.target.value)} />
                <span style={{ width: 24 }}>{row.unit}</span>
                <button type="button" aria-label={`Remove ${row.name} from recipe ${index + 1}`} style={buttonStyle} onClick={() => update({ ingredients: rule.ingredients.filter((_, i) => i !== ri) })}>&times;</button>
            </div>)}
        </>}
        <details style={{ marginTop: 14 }}>
            <summary style={{ color: '#805737', cursor: 'pointer', fontSize: 12 }}>More options</summary>
            <p style={{ color: '#777', fontSize: 12 }}>For combinations, all selected options must match.</p>
            {rule.conditions.slice(1).map((condition, offset) => <div key={offset} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {selectOption(condition, offset + 1)}
                <button type="button" style={buttonStyle} onClick={() => update({ conditions: rule.conditions.filter((_, i) => i !== offset + 1) })}>Remove</button>
            </div>)}
            {rule.conditions.length < 8 && <button type="button" style={buttonStyle} onClick={() => update({ conditions: [...rule.conditions, {}] })}>+ Add another matching option</button>}
            {choices.some(choice => choice.type === 'portion' && choice.option === 'platter') && rule.ingredients.map((row, ri) => <label key={row.inventoryId} style={{ display: 'block', marginTop: 10 }}>
                {row.name}: multiply by <input required aria-label={`${row.name} rule platter multiplier`} style={{ ...inputStyle, width: 65 }} type="number" min="0.001" max="1000" step="0.001" value={row.platterMultiplier} onChange={e => changeAmount(ri, 'platterMultiplier', e.target.value)} /> for a platter
            </label>)}
        </details>
        {rule.conditions.length > 1 && <p style={{ fontSize: 12, color: '#777', marginBottom: 0 }}>Also requires: {rule.conditions.slice(1).map(c => c.option || 'Choose another option').join(', ')}</p>}
    </div>;
}

export default function RecipeOptionRules({ rules, onChange, inventory, choices }) {
    return <div data-recipe-options style={{ gridColumn: '1/-1', marginBottom: 16 }}>
        <strong style={{ fontSize: 12 }}>INGREDIENTS FOR SIZES & ADD-ONS (OPTIONAL)</strong>
        <p style={{ fontSize: 12, color: '#777' }}>Only fill this in when an option uses different ingredients. Example: Large coffee uses 24 g of beans instead of the usual 18 g.</p>
        {rules.map((rule, index) => <RecipeEntry key={index} rule={rule} index={index} inventory={inventory} choices={choices}
            update={patch => onChange(rules.map((entry, i) => i === index ? { ...entry, ...patch } : entry))}
            remove={() => onChange(rules.filter((_, i) => i !== index))} />)}
        {rules.length < 50 && <button type="button" style={buttonStyle} onClick={() => onChange([...rules, { conditions: [{}], mode: 'replace', ingredients: [] }])}>+ Add size or add-on recipe</button>}
    </div>;
}
