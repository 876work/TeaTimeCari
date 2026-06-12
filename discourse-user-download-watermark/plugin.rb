# frozen_string_literal: true

# name: discourse-user-download-watermark
# about: Serves temporary, per-user watermarked derivatives for post upload image downloads.
# version: 0.1.0
# authors: Tea Time Cari
# required_version: 3.4.0
# enabled_site_setting: enable_user_download_watermark

register_asset "javascripts/discourse/initializers/user-download-watermark.js"

module ::UserDownloadWatermark
  PLUGIN_NAME = "discourse-user-download-watermark"
end

require_relative "lib/user_download_watermark/engine"

after_initialize do
  require_relative "app/controllers/user_download_watermark/downloads_controller"
  require_relative "lib/user_download_watermark/watermarker"

  Discourse::Application.routes.append do
    mount ::UserDownloadWatermark::Engine, at: "/user-download-watermark"
  end
end
