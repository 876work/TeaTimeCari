# Discourse User Download Watermark

`discourse-user-download-watermark` is a server-side Discourse plugin for Tea Time Cari. It serves temporary, per-request image derivatives for post upload downloads and stamps each derivative with visible text:

```text
Tea Time Cari Community
@current_logged_in_username
```

Anonymous users who can already see the public post receive the fallback username line:

```text
Guest
```

## Implementation approach

This repository contains a Discourse theme and integration documentation, but it does not vendor Discourse core. Discourse upload/download handling therefore remains inside the deployed Discourse application. This plugin integrates with that flow instead of modifying core:

1. A cooked-post client initializer rewrites links that point at supported `/uploads/` image files to the plugin download endpoint.
2. The server endpoint resolves the upload using Discourse `Upload` records only. It never trusts a client-provided username or filesystem path.
3. The endpoint only serves uploads associated with `PostUpload` records, which avoids avatars, emojis, theme assets, icons, and admin assets that are not part of a post.
4. The endpoint checks the active `guardian` against the upload's post and topic before generating any derivative.
5. The original uploaded file is opened as an input, a new temporary derivative is generated with MiniMagick/ImageMagick, and only the derivative is returned as an attachment response.
6. When caching is enabled, the cache key includes the upload id, the requesting user id (or `guest`), upload version/hash data, and watermark setting values so one user's watermark is never reused for another user.

MiniMagick is used because it is the Ruby wrapper already commonly available in Discourse installations through Discourse's image processing stack and delegates to ImageMagick, which supports JPG, JPEG, PNG, and WEBP overlays.

## Supported image types

The plugin watermarks only:

- `jpg`
- `jpeg`
- `png`
- `webp`

Unsupported post uploads are redirected to the original upload URL after the same post/topic permission check. If a watermark cannot be generated, the plugin logs the detailed server-side error and returns a generic error message without exposing a stack trace.

## Settings

Configure these in Discourse Admin > Settings after installing the plugin:

| Setting | Default | Purpose |
| --- | --- | --- |
| `enable_user_download_watermark` | `true` | Enables the plugin route and cooked-post link rewriting. |
| `watermark_text` | `Tea Time Cari Community` | First line of the watermark. |
| `watermark_include_username` | `true` | Adds `@username` for logged-in users or `Guest` for anonymous users. |
| `watermark_position` | `bottom_right` | Position for the overlay (`top_left`, `top_right`, `bottom_left`, `bottom_right`, or `center`). |
| `watermark_opacity` | `0.35` | Semi-transparent text opacity. |
| `watermark_font_size` | `responsive` | Responsive scaling, or a numeric pixel size. |
| `watermark_margin` | `24` | Margin from the selected edge in pixels. |
| `watermark_apply_to_categories` | empty | Optional category allow-list. Empty means all post categories are eligible. |
| `watermark_excluded_categories` | empty | Optional category block-list. Excluded categories are never watermarked. |
| `watermark_cache_enabled` | `true` | Enables temporary derivative caching with per-upload, per-user, per-version cache keys. |

## Installation

1. Copy this directory into the Discourse `plugins/` directory:

   ```bash
   cd /var/discourse
   git clone <this-repo-or-plugin-path> plugins/discourse-user-download-watermark
   ```

2. Rebuild or restart Discourse according to your deployment method:

   ```bash
   ./launcher rebuild app
   ```

3. Confirm ImageMagick is available in the Discourse container:

   ```bash
   magick -version || convert -version
   ```

4. Enable and configure the plugin settings in Admin > Settings.

## Testing

From a Discourse checkout with this plugin installed:

```bash
bundle exec rspec plugins/discourse-user-download-watermark/spec/requests/user_download_watermark_controller_spec.rb
```

Manual smoke test:

1. Log in as a regular user who can see a topic with an uploaded JPG/PNG/WEBP image.
2. Open the topic and click the upload image link.
3. Confirm the downloaded file is a derivative with `Tea Time Cari Community` and the logged-in username.
4. Log in as a different user and download the same upload.
5. Confirm the second derivative contains the second username.
6. Confirm the original uploaded image in Discourse storage has not changed.
7. Try a private category as a user without access and confirm the image cannot be downloaded through the plugin route.

## Limitations

- This plugin targets post upload links. It intentionally ignores uploads that cannot be tied to a `PostUpload` record.
- Existing direct links outside cooked post content may still point to the original Discourse upload URL unless customized to use `/user-download-watermark/uploads/:upload_id` or `/user-download-watermark/uploads/by-url?url=/uploads/...`.
- Remote object stores are supported by reading the upload URL when a local upload path is unavailable, but very large images may take longer to process.
- The plugin does not provide forensic/hidden watermarking; it adds a visible semi-transparent text overlay only.
