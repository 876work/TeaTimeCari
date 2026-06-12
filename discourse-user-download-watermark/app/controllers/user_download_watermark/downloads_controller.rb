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

      return redirect_to upload.url if !category_allowed?(post.topic&.category_id)

      watermarker = UserDownloadWatermark::Watermarker.new(upload: upload, user: current_user, post: post)
      return redirect_to upload.url if !watermarker.supported?

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
      render plain: "Unable to prepare the watermarked download.", status: :internal_server_error
    end

    private

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
