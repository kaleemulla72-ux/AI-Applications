import OpenAI from 'openai';
import { createAppointment, db, getBusinessSettings } from './db.js';

const systemPrompt = `You are an AI receptionist for a beauty parlour. Help customers with service details, pricing, packages, appointment booking, rescheduling, cancellation, and feedback. Be polite, friendly, professional, and concise. Always collect customer name, phone number, service, date, and time before creating a booking. Do not confirm unavailable slots. If price or availability is unclear, say the owner will confirm. Do not give medical or skin treatment guarantees.`;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function handleChatMessage({ sessionId, message }) {
  await db.run('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)', [
    sessionId,
    'user',
    message
  ]);

  const services = await db.all('SELECT id, name, price, duration, description FROM services WHERE active = 1 ORDER BY id');
  const settings = await getBusinessSettings();
  const recent = await db.all(
    'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT 12',
    [sessionId]
  );

  const conversationText = recent
    .filter((item) => item.role === 'user')
    .reverse()
    .map((item) => item.content)
    .join('\n');
  const extracted = extractBooking(conversationText, services);

  if (extracted.ready) {
    try {
      const appointment = await createAppointment({
        name: extracted.name,
        phone: extracted.phone,
        serviceId: extracted.service.id,
        date: extracted.date,
        time: extracted.time,
        notes: 'Created from AI chat'
      });
      const reply = `Thank you, ${appointment.customer_name}. I created your ${appointment.service_name} booking for ${appointment.date} at ${appointment.time}. It is pending now, and the owner will confirm if any adjustment is needed.`;
      await saveAssistantReply(sessionId, reply);
      return { reply, appointment };
    } catch (error) {
      const reply = `${error.message} The owner can help confirm another suitable slot if needed.`;
      await saveAssistantReply(sessionId, reply);
      return { reply };
    }
  }

  const fallback = localReply(message, services, settings, extracted);
  if (!openai) {
    await saveAssistantReply(sessionId, fallback);
    return { reply: fallback };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'system',
          content: `Business settings: ${JSON.stringify(settings)}\nServices: ${JSON.stringify(services)}\nKnown booking details from this conversation: ${JSON.stringify(publicBookingDetails(extracted))}\nIf any booking detail is missing, ask only for the missing fields. Do not invent booking confirmations; the server creates appointments when all details are available.`
        },
        ...recent.reverse().map((item) => ({ role: item.role, content: item.content })),
        { role: 'user', content: message }
      ],
      temperature: 0.3,
      max_tokens: 220
    });
    const reply = completion.choices[0]?.message?.content || fallback;
    await saveAssistantReply(sessionId, reply);
    return { reply };
  } catch {
    await saveAssistantReply(sessionId, fallback);
    return { reply: fallback };
  }
}

function saveAssistantReply(sessionId, reply) {
  return db.run('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)', [
    sessionId,
    'assistant',
    reply
  ]);
}

function localReply(message, services, settings, extracted) {
  const lower = message.toLowerCase();
  const matched = services.find((service) => lower.includes(service.name.toLowerCase()));

  if (hasBookingSignal(message)) {
    const missing = getMissingBookingFields(extracted);
    if (missing.length) {
      return `I can book that for you. Please share your ${formatMissingFields(missing)}.`;
    }
  }

  if (matched) {
    return `${matched.name} is Rs.${matched.price} and takes about ${matched.duration} minutes. ${matched.description} To book it, please share your name, phone number, preferred date, and time.`;
  }

  if (lower.includes('bridal') || lower.includes('party') || lower.includes('makeup')) {
    const makeup = services.filter((service) => service.name.toLowerCase().includes('makeup'));
    return `Our makeup packages are: ${makeup.map((service) => `${service.name} Rs.${service.price}`).join(', ')}. Bridal packages include a more detailed look, draping, and hairstyling. Final custom requirements can be confirmed by the owner.`;
  }

  if (lower.includes('book') || lower.includes('appointment')) {
    return `I can help with that. Please share your ${formatMissingFields(getMissingBookingFields(extracted))} so I can create the booking.`;
  }

  if (lower.includes('time') || lower.includes('hour') || lower.includes('open')) {
    return `${settings.parlour_name} is open ${settings.opening_hours}.`;
  }

  return `Hi, I am the AI receptionist for ${settings.parlour_name}. I can help with services, prices, bridal or party packages, and appointments. Popular services include ${services.slice(0, 5).map((service) => service.name).join(', ')}.`;
}

function extractBooking(message, services) {
  const phone = extractPhone(message);
  const date = extractDate(message);
  const time = extractTime(message);
  const service = extractService(message, services);
  const name = extractName(message, phone, service);

  return {
    name,
    phone,
    date,
    time,
    service,
    ready: Boolean(name && phone && date && time && service)
  };
}

function extractPhone(text) {
  const match = text.match(/(?:\+?91[\s-]?)?[6-9]\d{9}\b/);
  return match?.[0]?.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
}

function extractDate(text) {
  const lower = text.toLowerCase();
  const today = new Date();

  if (/\btoday\b/.test(lower)) return formatDate(today);
  if (/\btomorrow\b/.test(lower)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return formatDate(tomorrow);
  }

  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (iso) return iso;

  const slashDate = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (slashDate) {
    const [, day, month, year] = slashDate;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

function extractTime(text) {
  const amPm = text.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (amPm) {
    let hour = Number(amPm[1]);
    const minute = amPm[2] || '00';
    const period = amPm[3].toLowerCase();
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  const twentyFour = text.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0];
  if (twentyFour) {
    const [hour, minute] = twentyFour.split(':');
    return `${hour.padStart(2, '0')}:${minute}`;
  }

  return null;
}

function extractService(text, services) {
  const lower = text.toLowerCase();
  return services.find((item) => lower.includes(item.name.toLowerCase()));
}

function extractName(text, phone, service) {
  const explicit = text.match(/(?:name is|i am|i'm|this is)\s+([a-zA-Z ]{2,40})/i)?.[1]?.trim();
  if (explicit) return cleanName(explicit);

  const commaName = findNameInCommaParts(text, phone, service);
  if (commaName) return commaName;

  if (service) {
    const beforeService = text.toLowerCase().split(service.name.toLowerCase())[0];
    const possible = beforeService.split(/[\n,]/).map((part) => part.trim()).filter(Boolean).pop();
    if (possible && /^[a-zA-Z ]{2,40}$/.test(possible)) return cleanName(possible);
  }

  return null;
}

function findNameInCommaParts(text, phone, service) {
  const serviceName = service?.name.toLowerCase();
  const parts = text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const lower = part.toLowerCase();
    const digits = part.replace(/\D/g, '');
    const looksLikePhone = phone && (digits === phone || digits === `91${phone}`);
    const looksLikeService = serviceName && lower.includes(serviceName);
    const looksLikeDateOrTime = /\b(today|tomorrow|am|pm)\b/i.test(part)
      || /\b\d{4}-\d{2}-\d{2}\b/.test(part)
      || /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/.test(part)
      || /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(part);

    if (!looksLikePhone && !looksLikeService && !looksLikeDateOrTime && /^[a-zA-Z ]{2,40}$/.test(part)) {
      return cleanName(part);
    }
  }
  return null;
}

function cleanName(name) {
  const cleaned = name
    .replace(/\b(book|booking|appointment|for|please|my|name|is)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function hasBookingSignal(text) {
  return /\b(book|booking|appointment|schedule|reserve|today|tomorrow|am|pm)\b/i.test(text)
    || /(?:\+?91[\s-]?)?[6-9]\d{9}\b/.test(text)
    || /\b\d{4}-\d{2}-\d{2}\b/.test(text)
    || /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/.test(text);
}

function getMissingBookingFields(extracted) {
  const missing = [];
  if (!extracted.name) missing.push('name');
  if (!extracted.phone) missing.push('phone number');
  if (!extracted.service) missing.push('service');
  if (!extracted.date) missing.push('date');
  if (!extracted.time) missing.push('time');
  return missing;
}

function formatMissingFields(fields) {
  if (!fields.length) return 'details';
  if (fields.length === 1) return fields[0];
  return `${fields.slice(0, -1).join(', ')} and ${fields.at(-1)}`;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function publicBookingDetails(extracted) {
  return {
    name: extracted.name,
    phone: extracted.phone,
    service: extracted.service?.name,
    date: extracted.date,
    time: extracted.time,
    missing: getMissingBookingFields(extracted)
  };
}
