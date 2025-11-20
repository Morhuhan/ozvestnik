export async function verifyVkToken(accessToken: string) {
  const url = new URL("https://api.vk.com/method/users.get");
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("v", "5.131");
  url.searchParams.set("fields", "photo_100,first_name,last_name,email");

  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const data = await res.json().catch(() => ({} as any));

  if (data?.error) {
    throw new Error(`VK API error: ${data.error?.error_msg || "unknown"}`);
  }

  const user = data?.response?.[0];
  if (!user?.id) throw new Error("VK API: empty user");
  
  return {
    id: String(user.id),
    name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || `VK пользователь ${user.id}`,
    image: user.photo_100 || null,
    email: user.email || null,
  };
}