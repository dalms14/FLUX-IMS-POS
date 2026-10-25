import React from 'react';
import { FiCoffee, FiPackage, FiBarChart2, FiUsers, FiExternalLink } from 'react-icons/fi';

const features = [
  [FiCoffee, 'Sales & checkout', 'Cash and GCash checkout, item discounts, receipts, and transaction records.'],
  [FiPackage, 'Inventory & purchasing', 'Ingredient stock, product recipes, expiration tracking, and purchase orders.'],
  [FiBarChart2, 'Reports & forecasting', 'Sales reports and a linear regression forecast. Sample-data demonstration is available; real sales require verified history.'],
  [FiUsers, 'Accounts & access', 'Email verification, reusable role templates, first-login password changes, and a 15-minute inactivity timeout.'],
];

export default function AboutFluxSettings() {
  return <div className="settings-overview">
    <section className="settings-feature-card settings-about-hero">
      <div className="settings-about-brand"><img src="/logo192.png" alt="FLUX" /><span className="settings-eyebrow">Built for Eli Coffee · Antipolo</span></div>
      <h3>Everyday operations, in one place.</h3>
      <p>FLUX brings point of sale, inventory management, and sales reporting together to support the café’s daily workflow.</p>
      <a className="settings-site-link" href="https://fluxcafe.store" target="_blank" rel="noreferrer">fluxcafe.store <FiExternalLink aria-hidden="true" /></a>
    </section>
    <section aria-label="System features" className="settings-feature-grid">
      {features.map(([Icon, title, description]) => <article className="settings-feature-card" key={title}>
        <span className="settings-overview-icon"><Icon aria-hidden="true" /></span>
        <h3>{title}</h3><p>{description}</p>
      </article>)}
    </section>
    <footer className="settings-about-footer"><strong>FLUX · Point of Sale & Inventory Management</strong><span>Developed as an academic capstone project · {new Date().getFullYear()}</span></footer>
  </div>;
}
