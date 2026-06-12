import { apiInitializer } from "discourse/lib/api";

const SUPPORTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function uploadPathFromUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (!parsed.pathname.startsWith("/uploads/")) {
      return null;
    }

    const extension = parsed.pathname.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return null;
    }

    return parsed.pathname;
  } catch {
    return null;
  }
}

export default apiInitializer("1.8.0", (api) => {
  if (!api.container.lookup("service:site-settings").enable_user_download_watermark) {
    return;
  }

  api.decorateCookedElement((cooked) => {
    cooked.querySelectorAll('a[href*="/uploads/"]').forEach((link) => {
      const uploadPath = uploadPathFromUrl(link.getAttribute("href"));
      if (!uploadPath) {
        return;
      }

      const downloadUrl = `/user-download-watermark/uploads/by-url?url=${encodeURIComponent(uploadPath)}`;
      link.setAttribute("href", downloadUrl);
      link.setAttribute("data-user-download-watermark", "true");
      link.setAttribute("download", "");
    });
  });
});
