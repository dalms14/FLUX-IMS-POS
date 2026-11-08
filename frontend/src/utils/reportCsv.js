import { loginActivityLabel, loginActivityDetails } from './loginActivity';

export const REPORT_CSV_OPTIONS = [
  ['sales_transactions', 'Sales transactions'],
  ['financial_summary', 'Financial summary'],
  ['payment_methods', 'Payment methods'],
  ['product_sales', 'Product sales'],
  ['refunds', 'Refund records'],
  ['cancelled_checkouts', 'Cancelled checkouts'],
  ['inventory', 'Current inventory'],
  ['inventory_movements', 'Inventory movements'],
  ['activity_logs', 'Activity logs (system changes)'],
  ['login_activity', 'Login activity'],
];

const timestamp = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
};

// Each export has one header and a consistent set of columns for one record type.
// The page supplies records from its applied reporting period and visible filters.
export function buildReportCsvRows(type, { report, inventory, inventoryHistory, refunds, systemAudit, loginActivity }) {
  switch (type) {
    case 'sales_transactions':
      return [
        ['Receipt number', 'Order number', 'Date/time (Philippine time)', 'Cashier', 'Customer type', 'Service type', 'Order status', 'Payment method', 'Subtotal (PHP)', 'Discount (PHP)', 'Tax (PHP)', 'Total (PHP)', 'Amount tendered (PHP)', 'Change (PHP)'],
        ...report.salesTransactions.map(row => [row.receiptNo, row.orderNo, timestamp(row.createdAt), row.cashier, row.customerType, row.serviceType, row.orderStatus, row.paymentMethod, row.subtotal, row.discount, row.tax, row.total, row.amountTendered, row.change]),
      ];
    case 'financial_summary':
      return [
        ['Gross sales (PHP)', 'Approved/completed refunds (PHP)', 'Net sales (PHP)', 'Discounts (PHP)', 'Tax (PHP)', 'Pending refunds (PHP)', 'Sales transactions', 'Cancelled checkouts'],
        [report.grossSales, report.refundTotal, report.netSales, report.discounts, report.tax, report.pendingRefundTotal, report.salesTransactions.length, report.cancelledTransactions.length],
      ];
    case 'payment_methods':
      return [['Payment method', 'Orders', 'Gross sales (PHP)', 'Amount tendered (PHP)', 'Change (PHP)'],
        ...report.paymentRows.map(row => [row.method, row.orders, row.gross, row.amountTendered, row.change])];
    case 'product_sales':
      return [['Product', 'Category', 'Quantity sold', 'Gross sales (PHP)'],
        ...report.productRows.map(row => [row.name, row.category, row.quantity, row.gross])];
    case 'refunds':
      return [['Refund record ID', 'Receipt number', 'Date/time (Philippine time)', 'Status', 'Payment method', 'Refund total (PHP)', 'Processed by', 'Reason'],
        ...refunds.map(row => [row._id, row.receiptNo, timestamp(row.createdAt), row.status, row.paymentMethod, row.totalRefunded, row.refundedBy, row.reason])];
    case 'cancelled_checkouts':
      return [['Receipt number', 'Order number', 'Date/time (Philippine time)', 'Cashier', 'Reason'],
        ...report.cancelledTransactions.map(row => [row.receiptNo, row.orderNo, timestamp(row.createdAt), row.cashier, row.cancelReason])];
    case 'inventory':
      return [['Inventory item', 'Category', 'Current stock', 'Unit', 'Low-stock threshold', 'Status'],
        ...inventory.map(row => [row.name, row.category || 'General', row.stock, row.unit, row.lowStockAt,
          Number(row.stock || 0) === 0 ? 'Out of Stock' : Number(row.stock || 0) <= Number(row.lowStockAt || 0) ? 'Low Stock' : 'In Stock'])];
    case 'inventory_movements':
      return [['Date/time (Philippine time)', 'Item', 'Action', 'Quantity', 'Unit', 'Performed by', 'Reason'],
        ...inventoryHistory.map(row => [timestamp(row.date), row.item, row.action, row.amount ?? row.quantity, row.unit, row.by, row.reason])];
    case 'activity_logs':
      return [['Date/time (Philippine time)', 'Module', 'Action', 'Record', 'Performed by', 'Details'],
        ...systemAudit.map(row => [timestamp(row.createdAt), row.module === 'Staff' ? 'User Accounts' : row.module, row.action, row.entityName || row.entityId, row.actor, row.details])];
    case 'login_activity':
      return [['Date/time (Philippine time)', 'Name', 'Email', 'Role', 'Staff ID', 'Status', 'Device/browser', 'Shift details'],
        ...loginActivity.map(row => [timestamp(row.createdAt), row.name, row.email, row.role, row.staffId,
          loginActivityLabel(row.action), row.userAgent, loginActivityDetails(row)])];
    default:
      throw new Error('Select a valid CSV record type.');
  }
}
