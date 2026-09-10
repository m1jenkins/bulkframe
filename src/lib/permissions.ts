export async function hasHostPermission(): Promise<boolean> {
  return browser.permissions.contains({ origins: ['<all_urls>'] });
}

export async function requestHostPermission(): Promise<boolean> {
  if (await hasHostPermission()) return true;
  return browser.permissions.request({ origins: ['<all_urls>'] });
}
