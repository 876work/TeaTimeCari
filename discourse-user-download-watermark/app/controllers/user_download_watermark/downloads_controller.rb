# frozen_string_literal: true

module ::UserDownloadWatermark
  class DownloadsController < ::ApplicationController
    requires_plugin UserDownloadWatermark::PLUGIN_NAME

    skip_before_action :check_xhr, only: [:show]

    def show
      raise Discourse::NotFound if !SiteSetting.enable_user_download_watermark

      upload = resolve_upload
      raise Discourse::NotFound if upload.blank?

      post = authorized_post_for(upload)
      raise Discourse::InvalidAccess if post.blank?

      return render_unwatermarked_notice(upload.url) if !category_allowed?(post.topic&.category_id)

      watermarker = UserDownloadWatermark::Watermarker.new(upload: upload, user: current_user, post: post)
      return render_unwatermarked_notice(upload.url) if !watermarker.supported?

      path = watermarker.build
      send_file(
        path,
        filename: watermarker.output_filename,
        disposition: "attachment",
        type: upload.content_type.presence || "application/octet-stream"
      )
    rescue Discourse::NotFound, Discourse::InvalidAccess
      raise
    rescue StandardError => e
      Rails.logger.error("#{UserDownloadWatermark::PLUGIN_NAME}: failed to watermark upload #{params[:upload_id]} for user #{current_user&.id || "guest"}: #{e.class}: #{e.message}")
      render_processing_error
    end

    private

    def render_unwatermarked_notice(original_url)
      safe_url = ERB::Util.html_escape(original_url)

      render(
        html: <<~HTML.html_safe,
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta http-equiv="refresh" content="3;url=#{safe_url}">
              <title>Preparing your download</title>
            </head>
            <body style="margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#F4FBFF; color:#1f2937; display:flex; align-items:center; justify-content:center; min-height:100vh;">
              <div style="max-width:420px; padding:32px; text-align:center;">
                <h1 style="font-size:18px; margin:0 0 12px;">This file isn't watermarked</h1>
                <p style="color:#4b5563; line-height:1.6; margin:0 0 20px;">This category or file type isn't eligible for watermarking, so you're getting the original file. Your download should start automatically.</p>
                <a href="#{safe_url}" style="display:inline-block; background:#4B9EC8; color:#ffffff; padding:10px 18px; border-radius:10px; text-decoration:none; font-weight:600;">Download original file</a>
              </div>
            </body>
          </html>
        HTML
        layout: false,
      )
    end

    def render_processing_error
      render(
        html: <<~HTML.html_safe,
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Download unavailable</title>
            </head>
            <body style="margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#F4FBFF; color:#1f2937; display:flex; align-items:center; justify-content:center; min-height:100vh;">
              <div style="max-width:420px; padding:32px; text-align:center;">
                <h1 style="font-size:18px; margin:0 0 12px;">We couldn't prepare this download</h1>
                <p style="color:#4b5563; line-height:1.6; margin:0;">Something went wrong preparing the watermarked version of this file. Please go back and try the download again in a moment.</p>
              </div>
            </body>
          </html>
        HTML
        layout: false,
        status: :internal_server_error,
      )
    end

    def resolve_upload
      return Upload.find_by(id: params[:upload_id].to_i) if params[:upload_id].present?

      path = normalized_upload_path(params[:url])
      return if path.blank?

      Upload.find_by(url: path) ||
        Upload.find_by(url: Discourse.base_url + path) ||
        upload_from_short_url(path)
    end

    def normalized_upload_path(url)
      parsed = URI.parse(url.to_s)
      path = parsed.path.presence
      return if path.blank? || !path.start_with?("/uploads/")

      path
    rescue URI::InvalidURIError
      nil
    end

    def upload_from_short_url(path)
      match = path.match(%r{\A/uploads/short-url/([A-Za-z0-9]+)\.[A-Za-z0-9]+\z})
      return if match.blank? || !Upload.column_names.include?("base62_sha1")

      Upload.find_by(base62_sha1: match[1])
    end

    def authorized_post_for(upload)
      posts_for_upload(upload).detect do |post|
        guardian.can_see?(post.topic) && guardian.can_see_post?(post)
      end
    end

    def posts_for_upload(upload)
      if defined?(PostUpload)
        PostUpload.where(upload_id: upload.id).includes(post: :topic).map(&:post).compact
      else
        []
      end
    end

    def category_allowed?(category_id)
      apply_to = category_ids(SiteSetting.watermark_apply_to_categories)
      excluded = category_ids(SiteSetting.watermark_excluded_categories)

      return false if category_id.present? && excluded.include?(category_id)
      return true if apply_to.blank?

      category_id.present? && apply_to.include?(category_id)
    end

    def category_ids(value)
      value.to_s.split("|").filter_map { |id| id.presence&.to_i }.reject(&:zero?)
    end
  end
end
