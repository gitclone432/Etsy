// Parses the "Label: value" block copied from an Etsy order into Order
// Fulfilment row fields. Lines whose label isn't recognised are treated as a
// continuation of the previous value, so a wrapped item title stays intact.

const LABEL_TO_KEY = {
  'order id': 'orderId',
  'order date': 'orderDate',
  'order time': 'orderTime',
  'ship by': 'shipBy',
  name: 'name',
  'address line 1': 'addressLine1',
  'address line 2': 'addressLine2',
  city: 'city',
  state: 'state',
  zip: 'zip',
  country: 'country',
  phone: 'phone',
  item: 'item',
  sku: 'sku',
  quantity: 'quantity',
  'items cost': 'itemsCost',
  coupon: 'coupon',
  discount: 'discount',
  subtotal: 'subtotal',
  'shipping cost': 'shippingCost',
  tax: 'tax',
  total: 'total',
  'payment method': 'paymentMethod',
  'tracking status': 'trackingStatus',
};

// Etsy source label -> Order Fulfilment column, shown in the preview.
export const ETSY_AUTO_ADD_FIELD_MAP = [
  { source: 'orderDate', sourceLabel: 'Order date', field: 'dateSold', fieldLabel: 'Date of Sold' },
  { source: 'orderTime', sourceLabel: 'Order time', field: 'etsyOrdersReceivedTime', fieldLabel: 'Etsy Orders Received Time' },
  { source: 'shipBy', sourceLabel: 'Ship by', field: 'shipBy', fieldLabel: 'Ship By' },
  { source: 'item', sourceLabel: 'Item', field: 'productName', fieldLabel: 'Product Name' },
  { source: 'sku', sourceLabel: 'SKU', field: 'sku', fieldLabel: 'SKU' },
  { source: 'address', sourceLabel: 'Name → Phone', field: 'address', fieldLabel: 'Address' },
  { source: 'quantity', sourceLabel: 'Quantity', field: 'qty', fieldLabel: 'Qty' },
  { source: 'subtotal', sourceLabel: 'Subtotal', field: 'soldFor', fieldLabel: 'Etsy Price Details' },
  { source: 'tax', sourceLabel: 'Tax', field: 'tax', fieldLabel: 'Tax' },
  { source: 'total', sourceLabel: 'Total', field: 'total', fieldLabel: 'Total' },
];

export function parseEtsyOrderText(text) {
  const values = {};
  let lastKey = null;

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const colon = line.indexOf(':');
    const key = colon > 0 ? LABEL_TO_KEY[line.slice(0, colon).trim().toLowerCase()] : null;

    if (key) {
      values[key] = line.slice(colon + 1).trim();
      lastKey = key;
    } else if (lastKey) {
      values[lastKey] = `${values[lastKey]} ${line}`.trim();
    }
  }

  return values;
}

// Etsy already uses YYYY-MM-DD; also accept M/D/YYYY in case the copy differs.
function normalizeDate(value) {
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return text;
}

function buildAddress(values) {
  const part = (key) => String(values[key] ?? '').trim();
  const stateZip = [part('state'), part('zip')].filter(Boolean).join(' ');
  const cityLine = [part('city'), stateZip].filter(Boolean).join(', ');

  return [part('name'), part('addressLine1'), part('addressLine2'), cityLine, part('country'), part('phone')]
    .filter(Boolean)
    .join('\n');
}

export function buildRowFromEtsyOrder(values) {
  const row = {};
  const sources = { ...values, address: buildAddress(values) };
  for (const { source, field } of ETSY_AUTO_ADD_FIELD_MAP) {
    const value = String(sources[source] ?? '').trim();
    if (!value) continue;
    row[field] = field === 'dateSold' || field === 'shipBy' ? normalizeDate(value) : value;
  }
  return row;
}
