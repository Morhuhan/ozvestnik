import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'postbox.cloud.yandex.net',
  port: 587,
  secure: false,
  auth: {
    user: process.env.POSTBOX_API_KEY_ID,
    pass: process.env.POSTBOX_API_KEY_SECRET,
  },
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

  try {
    await transporter.sendMail({
      from: senderEmail,
      to: to,
      subject: subject,
      html: html,
    });
    console.log(`📨 Письмо отправлено на ${to} через Yandex Cloud Postbox`);
  } catch (error) {
    console.error('Ошибка при отправке email через Yandex Cloud Postbox:', error);
    throw error;
  }
}