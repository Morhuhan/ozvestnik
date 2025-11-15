type ShareButtonsProps = {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string; 
  className?: string;
};

export function ShareButtons({ url, title, description, imageUrl, className }: ShareButtonsProps) {
  const vkParams = new URLSearchParams({ 
    url,
    title,
  });

  const okParams = new URLSearchParams({ 
    url, 
    title 
  });
  if (imageUrl) okParams.set("imageUrl", imageUrl);

  const tgParams = new URLSearchParams({ 
    url, 
    text: title 
  });

  const vkShareUrl = `https://vk.com/share.php?${vkParams.toString()}`;
  const okShareUrl = `https://connect.ok.ru/offer?${okParams.toString()}`;
  const tgShareUrl = `https://t.me/share/url?${tgParams.toString()}`;

  const rootClassName = ["mt-6 flex flex-wrap items-center gap-2 text-sm text-neutral-700", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClassName}>
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Поделиться:
      </span>

      <a
        href={vkShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
        aria-label="Поделиться ВКонтакте"
      >
        ВКонтакте
      </a>

      <a
        href={okShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
        aria-label="Поделиться в Одноклассниках"
      >
        Одноклассники
      </a>

      <a
        href={tgShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
        aria-label="Поделиться в Telegram"
      >
        Telegram
      </a>
    </section>
  );
}