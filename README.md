https://озерский-вестник.рф - сайт газеты Озёрска

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Настройка Postfix на сервере для рассылки писем приложения

```bash
sudo apt update
sudo apt install postfix mailutils libsasl2-modules

# /etc/postfix/main.cf

smtpd_banner = $myhostname ESMTP $mail_name (Ubuntu)
biff = no
append_dot_mydomain = no
readme_directory = no
compatibility_level = 3.6

smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_tls_security_level = may

smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt
smtp_tls_session_cache_database = btree:${data_directory}/smtp_scache

smtpd_relay_restrictions = permit_mynetworks permit_sasl_authenticated defer_unauth_destination

myhostname = your-server-hostname
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases
myorigin = /etc/mailname
mydestination = xn----dtbhcghdehg5ad2aogq.xn--p1ai, $myhostname, localhost.localdomain, localhost
relayhost = [smtp.mail.ru]:587
mynetworks = 127.0.0.0/8 [::1]/128 172.17.0.0/16 172.18.0.0/16
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all

smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_sasl_mechanism_filter =
smtp_use_tls = yes
smtp_tls_security_level = encrypt
smtp_generic_maps = hash:/etc/postfix/generic

# /etc/postfix/sasl_passwd
[smtp.mail.ru]:587 radionovich.arkadiy@mail.ru:APP_PASSWORD_HERE

# /etc/postfix/generic
root                         radionovich.arkadiy@mail.ru
root@server-eemq4q           radionovich.arkadiy@mail.ru
root@server-eemq4q.novalocal radionovich.arkadiy@mail.ru
@server-eemq4q               radionovich.arkadiy@mail.ru
@server-eemq4q.novalocal     radionovich.arkadiy@mail.ru

# Перезапуск Postfix и проверка
sudo systemctl restart postfix

ss -ltnp | grep :25

echo "Тест Postfix" | mail -s "Test from server" radionovich.arkadiy@mail.ru

sudo journalctl -t postfix/smtp -f