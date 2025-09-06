const API = "https://cloud-api.yandex.net/v1/disk";

function authHeaders() {
  const token = process.env.YADISK_OAUTH_TOKEN!;
  return { Authorization: `OAuth ${token}` };
}

async function toApiError(res: Response, context: string) {
  const t = await res.text();
  let msg = t;
  try {
    const j = JSON.parse(t);
    msg = `${j.error || ""} ${j.message || ""}`.trim();
  } catch {}
  throw new Error(`${context}: ${res.status}${msg ? " — " + msg : ""}`);
}

export async function createFolder(path: string) {
  const url = new URL(`${API}/resources`);
  url.searchParams.set("path", path);
  const res = await fetch(url, { method: "PUT", headers: authHeaders() });
  if (!res.ok && res.status !== 409) await toApiError(res, "YaDisk mkdir failed");
}

function dirnameDisk(path: string) {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "disk:/";
}

export async function ensureDirRecursive(dir: string) {
  if (!dir.startsWith("disk:/")) throw new Error("Path must start with disk:/");
  let prefix = "disk:/";
  const parts = dir.slice("disk:/".length).split("/").filter(Boolean);
  for (const p of parts) {
    prefix += p;
    await createFolder(prefix);
    prefix += "/";
  }
}

export async function getUploadLink(path: string, overwrite = true) {
  const url = new URL(`${API}/resources/upload`);
  url.searchParams.set("path", path);
  url.searchParams.set("overwrite", overwrite ? "true" : "false");
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) await toApiError(res, "YaDisk upload link error");
  const json = (await res.json()) as { href: string; method: string };
  return json.href;
}

export async function getUploadLinkEnsuring(path: string, overwrite = true) {
  await ensureDirRecursive(dirnameDisk(path));
  return getUploadLink(path, overwrite);
}

export async function putToHref(href: string, body: Blob | File | ArrayBuffer | Uint8Array) {
  let blob: Blob;
  if (body instanceof Blob) {
    blob = body;
  } else if (body instanceof ArrayBuffer) {
    blob = new Blob([body]);
  } else {
    const u8 = body instanceof Uint8Array ? body : new Uint8Array(body as ArrayBufferLike);
    const ab = new ArrayBuffer(u8.byteLength);
    new Uint8Array(ab).set(u8);
    blob = new Blob([ab]);
  }

  const res = await fetch(href, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(blob.size) },
    cache: "no-store",
    body: blob,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`YaDisk PUT failed: ${res.status}${txt ? " — " + txt : ""}`);
  }
}

export async function publish(path: string) {
  const url = new URL(`${API}/resources/publish`);
  url.searchParams.set("path", path);
  const res = await fetch(url, { method: "PUT", headers: authHeaders() });
  if (!res.ok && res.status !== 409) throw new Error(`YaDisk publish failed: ${res.status}`);
}

export async function getResourceMeta(path: string, fields?: string) {
  const url = new URL(`${API}/resources`);
  url.searchParams.set("path", path);
  if (fields) url.searchParams.set("fields", fields);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`YaDisk meta failed: ${res.status}`);
  return res.json();
}

export async function getPublicDownloadHref(publicKey: string) {
  const url = new URL(`${API}/public/resources/download`);
  url.searchParams.set("public_key", publicKey);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`YaDisk public download failed: ${res.status}`);
  const json = (await res.json()) as { href: string };
  return json.href;
}

export async function getPrivateDownloadHref(path: string) {
  const url = new URL(`${API}/resources/download`);
  url.searchParams.set("path", path);
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) await toApiError(res, "YaDisk private download failed");
  const json = (await res.json()) as { href: string };
  return json.href;
}

async function getOperationStatus(opHref: string) {
  const base = new URL(API);
  const url = new URL(opHref, base);
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) await toApiError(res, "YaDisk get operation failed");
  return (await res.json()) as { status: "success" | "in-progress" | "failed" };
}

async function waitOperation(opHref: string, timeoutMs = 15000, intervalMs = 400) {
  const t0 = Date.now();
  let st = await getOperationStatus(opHref);
  while (st.status === "in-progress") {
    if (Date.now() - t0 > timeoutMs) throw new Error("YaDisk operation timeout");
    await new Promise((r) => setTimeout(r, intervalMs));
    st = await getOperationStatus(opHref);
  }
  if (st.status === "failed") throw new Error("YaDisk operation failed");
}

async function deleteOnce(path: string, permanently?: boolean) {
  const url = new URL(`${API}/resources`);
  url.searchParams.set("path", path);
  if (permanently) url.searchParams.set("permanently", "true");

  const res = await fetch(url, { method: "DELETE", headers: authHeaders(), cache: "no-store" });
  if (res.status === 204) return;
  if (res.status === 404 || res.status === 410) return;
  if (res.status === 202) {
    const json = (await res.json().catch(() => null)) as { href?: string } | null;
    if (json?.href) await waitOperation(json.href);
    return;
  }
  await toApiError(res, "YaDisk delete failed");
}

export async function deleteResource(path: string) {
  if (!path.startsWith("disk:/")) throw new Error("Invalid path for YaDisk delete: must start with disk:/");
  await deleteOnce(path, false);
}

export async function moveResource(from: string, to: string, overwrite = false) {
  if (!from.startsWith("disk:/") || !to.startsWith("disk:/")) throw new Error("YaDisk move: paths must start with disk:/");
  await ensureDirRecursive(dirnameDisk(to));
  const url = new URL(`${API}/resources/move`);
  url.searchParams.set("from", from);
  url.searchParams.set("path", to);
  if (overwrite) url.searchParams.set("overwrite", "true");

  const res = await fetch(url, { method: "POST", headers: authHeaders(), cache: "no-store" });
  if (res.status === 201) return;
  if (res.status === 202) {
    const json = (await res.json().catch(() => null)) as { href?: string } | null;
    if (json?.href) await waitOperation(json.href);
    return;
  }
  await toApiError(res, "YaDisk move failed");
}
