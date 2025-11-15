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

  const rootClassName = ["mt-8 border-t border-neutral-200 pt-6", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClassName}>
      <div className="text-sm font-semibold text-neutral-700 mb-3">
        Поделиться статьей:
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={vkShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 rounded-lg bg-[#0077FF] px-4 py-2.5 text-white transition-all hover:bg-[#0066DD] hover:shadow-md active:scale-95"
          aria-label="Поделиться ВКонтакте"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.711 0-.203.17-.406.44-.406h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.814-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.78 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.491-.085.744-.576.744z"/>
          </svg>
          <span className="text-sm font-medium">ВКонтакте</span>
        </a>

        <a
          href={okShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 rounded-lg bg-[#EE8208] px-4 py-2.5 text-white transition-all hover:bg-[#D97207] hover:shadow-md active:scale-95"
          aria-label="Поделиться в Одноклассниках"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.622c2.022 0 3.667 1.645 3.667 3.667S14.022 12 12 12s-3.667-1.711-3.667-3.711S9.978 4.622 12 4.622zM12 19.2c-2.667 0-5.022-1.422-6.289-3.556.022-.889 4.267-1.733 6.289-1.733s6.267.844 6.289 1.733C17.022 17.778 14.667 19.2 12 19.2z"/>
          </svg>
          <span className="text-sm font-medium">Одноклассники</span>
        </a>

        <a
          href={tgShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 rounded-lg bg-[#0088CC] px-4 py-2.5 text-white transition-all hover:bg-[#0077B5] hover:shadow-md active:scale-95"
          aria-label="Поделиться в Telegram"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.121.099.155.232.171.326.016.094.036.308.02.475z"/>
          </svg>
          <span className="text-sm font-medium">Telegram</span>
        </a>
      </div>
    </section>
  );
}