import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const sesClient = new SESv2Client({
  region: process.env.YC_REGION,
  credentials: {
    accessKeyId: process.env.YC_ACCESS_KEY_ID!,
    secretAccessKey: process.env.YC_SECRET_ACCESS_KEY!,
  },
  endpoint: "https://postbox.cloud.yandex.net",
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
}): Promise<void> {
  const senderEmail = from || process.env.EMAIL_FROM;
  if (!senderEmail) {
    throw new Error('Не указан email отправителя (EMAIL_FROM)');
  }

  const command = new SendEmailCommand({
    FromEmailAddress: senderEmail,
    Destination: {
      ToAddresses: [to],
    },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
        },
      },
    },
  });

  try {
    const response = await sesClient.send(command);
    console.log(`📨 Письмо отправлено на ${to} через Yandex Cloud Postbox API. MessageId: ${response.MessageId}`);
  } catch (error) {
    console.error('Ошибка при отправке email через Yandex Cloud Postbox API:', error);
    throw error;
  }
}