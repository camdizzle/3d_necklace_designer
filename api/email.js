// Transactional email via Resend.
//
// Sends two emails per order:
//   1. Order confirmation to the customer.
//   2. New-order notification to you (the admin).

const RESEND_API = 'https://api.resend.com/emails';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM || 'Chain Studio <orders@yourdomain.com>';

  if (!apiKey) {
    console.warn('EMAIL_API_KEY not set — skipping email');
    return;
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, html })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  return res.json();
}

function formatMoney(cents, currency = 'usd') {
  const dollars = (cents / 100).toFixed(2);
  const symbol = currency === 'usd' ? '$' : currency.toUpperCase() + ' ';
  return `${symbol}${dollars}`;
}

function designDetailsBlock(details) {
  if (!details) return '';
  const lines = details.split('\n').filter(Boolean);
  if (lines.length === 0) return '';
  const rows = lines.map(line => {
    const colorMatch = line.match(/\[color:\s*(#[0-9a-fA-F]{3,8})\]/);
    let display = escapeHtml(line.replace(/\[color:\s*#[0-9a-fA-F]{3,8}\]/, '').trim());
    if (colorMatch) {
      display += ` <span style="display:inline-block;width:14px;height:14px;background:${escapeHtml(colorMatch[1])};border-radius:3px;vertical-align:middle;border:1px solid #ccc;"></span> ${escapeHtml(colorMatch[1])}`;
    }
    return `<tr><td style="padding:4px 0;font-size:13px;">${display}</td></tr>`;
  }).join('');
  return `<table style="width:100%;margin:8px 0 12px;">${rows}</table>`;
}

function shippingBlock(shipping) {
  if (!shipping || !shipping.address) return '<p>No shipping address collected.</p>';
  const a = shipping.address;
  const lines = [
    shipping.name || '',
    a.line1 || '',
    a.line2 || '',
    [a.city, a.state, a.postal_code].filter(Boolean).join(', '),
    a.country || ''
  ].filter(Boolean);
  return `<p>${lines.join('<br>')}</p>`;
}

export async function sendOrderConfirmation(order) {
  const baseUrl = process.env.BASE_URL || 'https://yourdomain.com';

  const safeCustomerName = escapeHtml(order.customerName) || 'there';
  const safeDesignName = escapeHtml(order.designName);
  const safeComments = escapeHtml(order.comments);

  const html = `
    <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: #16213e; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #FFD700; margin: 0; font-size: 22px; letter-spacing: 2px;">CHAIN STUDIO</h1>
      </div>
      <div style="padding: 24px; background: #f9f9fb; border-radius: 0 0 8px 8px;">
        <h2 style="margin-top: 0;">Order Confirmed!</h2>
        <p>Hey ${safeCustomerName},</p>
        <p>We got your order and we're getting it printed. Here's the summary:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px 0; color: #666;">Order ID</td>
            <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(order.id)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px 0; color: #666;">Design</td>
            <td style="padding: 8px 0;">${safeDesignName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px 0; color: #666;">Quantity</td>
            <td style="padding: 8px 0;">${order.quantity || 1}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px 0; color: #666;">Total</td>
            <td style="padding: 8px 0; font-weight: 600;">${formatMoney(order.amountTotal, order.currency)}</td>
          </tr>
        </table>

        ${designDetailsBlock(order.designDetails)}

        ${order.comments ? `<div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:12px;margin:12px 0;">
          <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;font-weight:600;">Your Comments</p>
          <p style="margin:0;font-size:14px;">${safeComments}</p>
        </div>` : ''}

        <h3 style="margin-bottom: 4px;">Shipping to:</h3>
        ${shippingBlock(order.shipping)}

        <p style="margin-top: 24px; font-size: 13px; color: #666;">
          We'll email you again when your chain ships with a tracking number.
          Questions? Just reply to this email.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: order.customerEmail,
    subject: `Order confirmed: ${order.designName || 'Custom Chain'} — ${order.id}`,
    html
  });
}

export async function sendAdminNotification(order) {
  const adminEmail = process.env.EMAIL_FROM || 'orders@yourdomain.com';
  const baseUrl = process.env.BASE_URL || 'https://yourdomain.com';

  const safeCustomerName = escapeHtml(order.customerName);
  const safeCustomerEmail = escapeHtml(order.customerEmail);
  const safeDesignName = escapeHtml(order.designName);
  const safeComments = escapeHtml(order.comments);
  const safeDesignDetails = escapeHtml(order.designDetails);

  const html = `
    <div style="font-family: monospace; max-width: 560px;">
      <h2>New Order: ${escapeHtml(order.id)}</h2>
      <p><strong>Customer:</strong> ${safeCustomerName} &lt;${safeCustomerEmail}&gt;</p>
      <p><strong>Design:</strong> ${safeDesignName}</p>
      <p><strong>Quantity:</strong> ${order.quantity || 1}</p>
      <p><strong>Total:</strong> ${formatMoney(order.amountTotal, order.currency)}</p>

      <h3>Design Details:</h3>
      ${designDetailsBlock(order.designDetails) || `<p>${safeDesignDetails || '—'}</p>`}

      ${order.comments ? `<h3>Customer Comments:</h3>
      <div style="background:#fffbe6;border:1px solid #e6c200;border-radius:6px;padding:12px;margin:8px 0;">
        <p style="margin:0;white-space:pre-wrap;">${safeComments}</p>
      </div>` : ''}

      <h3>Ship to:</h3>
      ${shippingBlock(order.shipping)}
      <p><a href="${baseUrl}/admin/api/orders/${escapeHtml(order.id)}/stl">Download STL file</a></p>
      <p><a href="${baseUrl}/admin">Open admin dashboard</a></p>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `NEW ORDER: ${order.id} — ${order.designName} — ${formatMoney(order.amountTotal, order.currency)}`,
    html
  });
}

export async function sendShippingNotification(order) {
  if (!order.customerEmail || !order.trackingNumber) return;

  const html = `
    <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: #16213e; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #FFD700; margin: 0; font-size: 22px; letter-spacing: 2px;">CHAIN STUDIO</h1>
      </div>
      <div style="padding: 24px; background: #f9f9fb; border-radius: 0 0 8px 8px;">
        <h2 style="margin-top: 0;">Your Chain Has Shipped!</h2>
        <p>Hey ${escapeHtml(order.customerName) || 'there'},</p>
        <p>Your custom chain (${escapeHtml(order.designName)}) is on its way.</p>

        <div style="background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 16px; margin: 16px 0; text-align: center;">
          <p style="margin: 0 0 4px; color: #666; font-size: 12px; text-transform: uppercase;">${escapeHtml(order.trackingCarrier) || 'Tracking Number'}</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 1px;">${escapeHtml(order.trackingNumber)}</p>
        </div>

        <p style="font-size: 13px; color: #666;">
          Delivery typically takes 3-7 business days. If you have questions,
          just reply to this email.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: order.customerEmail,
    subject: `Your chain shipped! Tracking: ${order.trackingNumber}`,
    html
  });
}
