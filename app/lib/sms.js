// Twilio SMS integration
let twilioClient = null;

function getClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return null;
    }

    // Dynamic import to avoid issues in Edge runtime
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

// Send an SMS message
export async function sendSMS({ to, body, from }) {
  const client = getClient();

  if (!client) {
    console.warn('Twilio not configured — SMS not sent');
    return { success: false, error: 'Twilio not configured' };
  }

  const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) {
    return { success: false, error: 'No Twilio phone number configured' };
  }

  try {
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to: formatPhoneNumber(to),
    });

    return {
      success: true,
      sid: message.sid,
      status: message.status,
    };
  } catch (error) {
    console.error('Twilio error:', error.message);
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
}

// Send an SMS with template variables replaced
export async function sendTemplatedSMS({ to, body, variables, from }) {
  let resolvedBody = body;

  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      resolvedBody = resolvedBody.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value || '');
    }
  }

  return sendSMS({ to, body: resolvedBody, from });
}

// Format phone number to E.164 (US default)
function formatPhoneNumber(phone) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.startsWith('+')) return phone;
  return `+${digits}`;
}

// Check if Twilio is configured
export function isTwilioConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}
