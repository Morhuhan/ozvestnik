import { z } from 'zod';

const unisenderApiKey = process.env.UNISENDER_API_KEY;
if (!unisenderApiKey) {
  console.warn('UNISENDER_API_KEY не найден в переменных окружения');
}

const UNISENDER_API_URL = 'https://api.unisender.com/ru/api/sendEmail';

const UnisenderResponseSchema = z.object({
  result: z.object({
    message_id: z.string(),
  }),
  warnings: z.array(z.object({
    warning: z.string(),
  })).optional(),
});

const UnisenderErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}): Promise<string> {
  if (!unisenderApiKey) {
    throw new Error('UNISENDER_API_KEY не настроен');
  }

  const senderEmail = from || process.env.EMAIL_FROM;
  if (!senderEmail) {
    throw new Error('Не указан email отправителя (EMAIL_FROM)');
  }

  const params = new URLSearchParams({
    api_key: unisenderApiKey,
    format: 'json',
    to,
    subject,
    html,
    text,
    from: senderEmail,
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

    return result.data.result.message_id;
  } catch (error) {
    console.error('Ошибка при отправке email через UniSender:', error);
    throw error;
  }
}