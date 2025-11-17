import { z } from 'zod';

const unisenderApiKey = process.env.UNISENDER_API_KEY;
if (!unisenderApiKey) {
  console.warn('UNISENDER_API_KEY не найден в переменных окружения');
}

const UNISENDER_API_URL = 'https://api.unisender.com/ru/api/sendEmail';

const UnisenderResponseSchema = z.object({
  result: z.array(z.object({
    index: z.number(),
    email: z.string(),
    id: z.string().optional(),
    errors: z.array(z.object({
      code: z.string(),
      message: z.string(),
    })).optional(),
  })),
});

const UnisenderErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export async function sendEmail({
  to,
  subject,
  html,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<string> {
  if (!unisenderApiKey) {
    throw new Error('UNISENDER_API_KEY не настроен');
  }

  const listId = process.env.UNISENDER_LIST_ID;
  if (!listId) {
    throw new Error('UNISENDER_LIST_ID не настроен. Создайте список в UniSender и добавьте его ID в переменные окружения.');
  }

  const senderEmail = from || process.env.EMAIL_FROM;
  if (!senderEmail) {
    throw new Error('Не указан email отправителя (EMAIL_FROM)');
  }

  const match = senderEmail.match(/^(.+?)\s*<(.+?)>$/);
  const senderName = match ? match[1].trim() : 'Озерский Вестник';
  const senderAddress = match ? match[2].trim() : senderEmail;

  const params = new URLSearchParams({
    api_key: unisenderApiKey,
    format: 'json',
    email: to,
    sender_name: senderName,
    sender_email: senderAddress,
    subject: subject,
    body: html,
    list_id: listId,
    error_checking: '1',
  });

  try {
    const response = await fetch(UNISENDER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const errorResult = UnisenderErrorSchema.safeParse(data);
    if (errorResult.success) {
      throw new Error(`UniSender API Error (${errorResult.data.code}): ${errorResult.data.error}`);
    }

    const result = UnisenderResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('Некорректный ответ от UniSender:', data);
      throw new Error('Некорректный ответ от UniSender API');
    }

    const firstResult = result.data.result[0];

    if (firstResult.errors && firstResult.errors.length > 0) {
      const errorMessages = firstResult.errors.map(e => e.message).join('; ');
      throw new Error(`UniSender Email Error: ${errorMessages}`);
    }

    if (!firstResult.id) {
      throw new Error('UniSender не вернул ID сообщения.');
    }

    return firstResult.id;
  } catch (error) {
    console.error('Ошибка при отправке email через UniSender:', error);
    throw error;
  }
}