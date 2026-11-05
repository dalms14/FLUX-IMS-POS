import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipeOptionRules, { recipeChoices, recipeError } from './RecipeOptionRules';

const choices = recipeChoices([{ name: 'Size', options: ['Regular', 'Large'] }], [{ name: 'Milk' }], true);
const ingredient = { inventoryId: 'beans', name: 'Beans', unit: 'g', amountPerServing: 24, platterMultiplier: 3 };

test('rules require current options and valid amounts before product saving; zero is only allowed for replacement', () => {
    const rules = [{ conditions: [choices[1]], mode: 'replace', ingredients: [{ ...ingredient, amountPerServing: 0 }] }];
    expect(recipeError([], rules, choices)).toBe('');
    expect(recipeError([], [{ ...rules[0], mode: 'add' }], choices)).toMatch(/valid amounts/);
    expect(recipeError([], [{ ...rules[0], conditions: [{ type: 'variant', group: 'Size', option: 'Old' }] }], choices)).toMatch(/available option/);
    expect(recipeError([], [...rules, ...rules], choices)).toMatch(/duplicate/);
    expect(recipeError([{ ...ingredient, amountPerServing: '' }], [], choices)).toMatch(/positive/);
});

test('owner can choose an option and search active ingredients without changing other rules', () => {
    const onChange = jest.fn();
    const rules = [{ conditions: [{}], mode: 'replace', ingredients: [] }];
    render(<RecipeOptionRules rules={rules} choices={choices} onChange={onChange} inventory={[{ _id: 'milk', name: 'Milk', unit: 'ml' }, { _id: 'beans', name: 'Beans', unit: 'g' }, { _id: 'old', name: 'Archived', unit: 'g', archived: true }]} />);
    fireEvent.change(screen.getByLabelText('Rule 1 option 1'), { target: { value: JSON.stringify(['variant', 'Size', 'Large']) } });
    expect(onChange.mock.calls[0][0][0].conditions).toEqual([choices[1]]);
    fireEvent.change(screen.getByLabelText('Rule 1 option 1'), { target: { value: JSON.stringify([null, '', null]) } });
    expect(onChange.mock.calls[1][0][0].conditions).toEqual([{}]);
    fireEvent.click(screen.getByRole('button', { name: '+ Select ingredient' }));
    expect(screen.getAllByRole('button', { name: /^Add .+ \(/ }).map(button => button.textContent)).toEqual(['Beansg', 'Milkml']);
    fireEvent.change(screen.getByLabelText('Search ingredients for rule 1'), { target: { value: 'bean' } });
    expect(screen.queryByRole('button', { name: 'Add Milk (ml)' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Beans (g)' }));
    expect(screen.queryByLabelText('Search ingredients for rule 1')).not.toBeInTheDocument();
    expect(onChange.mock.calls[2][0][0].ingredients[0]).toEqual(expect.objectContaining({ inventoryId: 'beans', amountPerServing: '' }));
});
