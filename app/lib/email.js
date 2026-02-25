// SendGrid email integration
import sgMail from '@sendgrid/mail';

let initialized = false;

function init() {
  if (!initialized && process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    initialized = true;
  }
}

// Send a single email via SendGrid
export async function sendEmail({ to, from, subject, text, html, replyTo }) {
  init();

  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set — email not sent');
    return { success: false, error: 'SendGrid not configured' };
  }

  const msg = {
    to,
    from: from || process.env.SENDGRID_FROM_EMAIL || 'noreply@better-boss.ai',
    subject,
    text: text || stripHtml(html),
    html: html || text,
  };

  if (replyTo) {
    msg.replyTo = replyTo;
  }

  try {
    const [response] = await sgMail.send(msg);
    return {
      success: true,
      statusCode: response.statusCode,
      messageId: response.headers?.['x-message-id'],
    };
  } catch (error) {
    console.error('SendGrid error:', error?.response?.body || error.message);
    return {
      success: false,
      error: error?.response?.body?.errors?.[0]?.message || error.message,
    };
  }
}

// Send email with template variables replaced
export async function sendTemplatedEmail({ to, from, subject, body, variables, replyTo }) {
  let resolvedSubject = subject;
  let resolvedBody = body;

  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      resolvedSubject = resolvedSubject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value || '');
      resolvedBody = resolvedBody.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value || '');
    }
  }

  return sendEmail({
    to,
    from,
    subject: resolvedSubject,
    html: wrapInTemplate(resolvedBody),
    replyTo,
  });
}

// Simple HTML email wrapper
function wrapInTemplate(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      ${bodyHtml}
    </div>
    <div style="text-align:center;padding:16px;color:#999;font-size:12px;">
      Sent via Better Boss
    </div>
  </div>
</body>
</html>`;
}

// Strip HTML tags for plain text version
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
