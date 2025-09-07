// app/components/Avatar.tsx

type Props = {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  rounded?: boolean;
};

const DEFAULT_AVATAR_URL = "/images/guest.png";

export default function Avatar({
  src,
  alt = "",
  size = 64,
  className = "",
  rounded = true,
}: Props) {
  const url = src && src.trim() ? src : DEFAULT_AVATAR_URL;
  const radius = rounded ? "rounded-full" : "rounded-md";

  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 object-cover bg-neutral-200 ring-1 ring-neutral-300 ${radius} ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}
