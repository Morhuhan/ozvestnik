export async function verifyVkToken(accessToken: string, clientId: string) {
  const userInfoUrl = "https://id.vk.ru/oauth2/user_info";
  
  const formData = new URLSearchParams();
  formData.append("access_token", accessToken);
  formData.append("client_id", clientId);

  const res = await fetch(userInfoUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
    cache: "no-store",
  });

  const data = await res.json();

  if (data?.error) {
    throw new Error(`VK ID API error: ${data.error_description || data.error}`);
  }

  const user = data?.user;
  if (!user?.user_id) {
    throw new Error("VK ID API: empty user data");
  }
  
  return {
    id: String(user.user_id),
    name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || `VK пользователь ${user.user_id}`,
    image: user.avatar || null,
    email: user.email || null,
  };
}