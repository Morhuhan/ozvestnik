export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4">
      <h1 className="text-5xl font-bold text-neutral-900 mb-4">404</h1>
      <p className="text-lg text-neutral-700 mb-6">
        Упс… страница не найдена.
      </p>
      <a
        href="/"
        className="rounded-lg bg-neutral-900 px-6 py-3 text-white text-sm font-medium hover:bg-neutral-800 transition"
      >
        На главную
      </a>
    </div>
  );
}
