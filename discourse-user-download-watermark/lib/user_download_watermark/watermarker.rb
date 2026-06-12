# frozen_string_literal: true

require "fileutils"
require "mini_magick"
require "open-uri"
require "securerandom"

module ::UserDownloadWatermark
  class Watermarker
    SUPPORTED_EXTENSIONS = %w[jpg jpeg png webp].freeze
    POSITIONS = %w[top_left top_right bottom_left bottom_right center].freeze

    def self.positions
      POSITIONS
    end

    def initialize(upload:, user:, post:, logger: Rails.logger)
      @upload = upload
      @user = user
      @post = post
      @logger = logger
    end

    def supported?
      SUPPORTED_EXTENSIONS.include?(extension)
    end

    def cache_key
      user_part = @user&.id || "guest"
      version_part = upload_version

      "#{UserDownloadWatermark::PLUGIN_NAME}/#{@upload.id}/#{user_part}/#{version_part}/#{settings_fingerprint}"
    end

    def output_filename
      base = File.basename(original_filename, ".#{extension}").presence || "download"
      "#{base}-watermarked.#{extension}"
    end

    def build
      return cached_path if SiteSetting.watermark_cache_enabled && File.exist?(cached_path)

      source = materialize_source_upload
      output = SiteSetting.watermark_cache_enabled ? cached_path : uncached_path
      FileUtils.mkdir_p(File.dirname(output))

      image = MiniMagick::Image.open(source)
      image.auto_orient

      draw_watermark(image)
      image.write(output)
      output
    ensure
      cleanup_uncached_inputs(source, output)
    end

    private

    def draw_watermark(image)
      width = image.width.to_i
      height = image.height.to_i
      font_size = calculated_font_size(width, height)
      margin = SiteSetting.watermark_margin.to_i.clamp(4, [width, height].min / 4)
      text = watermark_lines.join("\n")
      escaped_text = text.gsub("\\", "\\\\").gsub("'", "\\\\'")

      image.combine_options do |cmd|
        cmd.gravity gravity
        cmd.fill "rgba(255,255,255,#{opacity})"
        cmd.stroke "rgba(0,0,0,#{[opacity + 0.2, 0.8].min})"
        cmd.strokewidth [font_size / 14, 1].max
        cmd.pointsize font_size
        cmd.interline_spacing [font_size / 4, 4].max
        cmd.draw "text #{margin},#{margin} '#{escaped_text}'"
      end
    end

    def watermark_lines
      lines = [SiteSetting.watermark_text.presence || "Tea Time Cari Community"]
      return lines if !SiteSetting.watermark_include_username

      username = @user&.username.presence
      lines << (username.present? ? "@#{username}" : "Guest")
      lines
    end

    def calculated_font_size(width, height)
      configured = SiteSetting.watermark_font_size.to_s
      return configured.to_i.clamp(10, 96) if configured.match?(/\A\d+\z/)

      # Responsive default: readable on small images, scaled but not dominant on large images.
      ([width, height].min * 0.045).round.clamp(14, 48)
    end

    def gravity
      case SiteSetting.watermark_position
      when "top_left" then "NorthWest"
      when "top_right" then "NorthEast"
      when "bottom_left" then "SouthWest"
      when "center" then "Center"
      else "SouthEast"
      end
    end

    def opacity
      SiteSetting.watermark_opacity.to_f.clamp(0.05, 1.0)
    end

    def cached_path
      @cached_path ||= File.join(cache_root, "#{Digest::SHA256.hexdigest(cache_key)}.#{extension}")
    end

    def uncached_path
      File.join(cache_root, "uncached-#{SecureRandom.hex(12)}.#{extension}")
    end

    def cache_root
      Rails.root.join("tmp", "user_download_watermark").to_s
    end

    def materialize_source_upload
      local = local_upload_path
      return local if local && File.exist?(local)

      tempfile_path = File.join(cache_root, "source-#{SecureRandom.hex(12)}.#{extension}")
      FileUtils.mkdir_p(File.dirname(tempfile_path))

      source_url = @upload.url.to_s.start_with?("http") ? @upload.url : "#{Discourse.base_url}#{@upload.url}"
      URI.open(source_url, "rb") { |input| File.binwrite(tempfile_path, input.read) }
      tempfile_path
    end

    def local_upload_path
      if defined?(Discourse.store) && Discourse.store.respond_to?(:path_for)
        path = Discourse.store.path_for(@upload)
        return path if path.present?
      end

      return if !@upload.respond_to?(:file_from_upload)

      path = @upload.file_from_upload
      path.respond_to?(:path) ? path.path : path
    rescue StandardError => e
      @logger.warn("#{UserDownloadWatermark::PLUGIN_NAME}: unable to resolve local upload #{@upload.id}: #{e.class}: #{e.message}")
      nil
    end

    def cleanup_uncached_inputs(source, output)
      FileUtils.rm_f(source) if source&.include?("/source-")
    end

    def original_filename
      @upload.original_filename.presence || @upload.url.to_s.split("/").last.to_s
    end

    def extension
      @extension ||= File.extname(original_filename).delete_prefix(".").downcase
    end

    def upload_version
      [
        @upload.try(:sha1),
        @upload.try(:etag),
        @upload.try(:updated_at)&.to_i,
        @upload.try(:filesize),
      ].compact.join("-").presence || "unknown"
    end

    def settings_fingerprint
      Digest::SHA256.hexdigest(
        [
          SiteSetting.watermark_text,
          SiteSetting.watermark_include_username,
          SiteSetting.watermark_position,
          SiteSetting.watermark_opacity,
          SiteSetting.watermark_font_size,
          SiteSetting.watermark_margin,
        ].join("|")
      )[0, 16]
    end
  end
end
