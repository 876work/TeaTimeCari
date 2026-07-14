# frozen_string_literal: true

require "rails_helper"
require_relative "../../lib/user_download_watermark/watermarker"

describe UserDownloadWatermark::DownloadsController do
  fab!(:user) { Fabricate(:user, username: "alice") }
  fab!(:other_user) { Fabricate(:user, username: "bob") }
  fab!(:category) { Fabricate(:category) }
  fab!(:private_category) { Fabricate(:private_category, group: Fabricate(:group)) }
  fab!(:topic) { Fabricate(:topic, category: category) }
  fab!(:post) { Fabricate(:post, topic: topic) }
  fab!(:private_topic) { Fabricate(:topic, category: private_category) }
  fab!(:private_post) { Fabricate(:post, topic: private_topic) }

  let(:png_bytes) do
    Base64.decode64(
      "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAeElEQVR4nO3QQQ3AIADAQMA/5+ECjiYKenbG" \
        "mjW33iw9gLn9uwN8ZkAGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBG" \
        "ZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEBGZEDGHgFm6AFyMyK2DQAAAABJRU5ErkJggg=="
    )
  end

  let(:txt_bytes) { "plain text" }

  before do
    SiteSetting.enable_user_download_watermark = true
    SiteSetting.watermark_text = "Tea Time Cari Community"
    SiteSetting.watermark_include_username = true
    SiteSetting.watermark_cache_enabled = true
  end

  def create_upload(filename:, bytes:, content_type:)
    UploadCreator.new(file_from_bytes(bytes, filename), filename).create_for(user.id).tap do |upload|
      upload.update!(content_type: content_type)
    end
  end

  def attach_upload(upload, target_post = post)
    Fabricate(:post_upload, post: target_post, upload: upload)
  end

  it "serves a logged-in user an image derivative with a username-specific cache key" do
    upload = create_upload(filename: "photo.png", bytes: png_bytes, content_type: "image/png")
    attach_upload(upload)
    sign_in(user)

    get "/user-download-watermark/uploads/#{upload.id}"

    expect(response.status).to eq(200)
    expect(response.headers["Content-Disposition"]).to include("photo-watermarked.png")
    expect(response.body.bytesize).to be > 0

    watermarker = UserDownloadWatermark::Watermarker.new(upload: upload, user: user, post: post)
    expect(watermarker.cache_key).to include("/#{upload.id}/#{user.id}/")
    expect(watermarker.send(:watermark_lines)).to eq(["Tea Time Cari Community", "@alice"])
  end

  it "does not modify the original upload" do
    upload = create_upload(filename: "original.png", bytes: png_bytes, content_type: "image/png")
    attach_upload(upload)
    original_sha1 = upload.sha1
    sign_in(user)

    get "/user-download-watermark/uploads/#{upload.id}"

    expect(response.status).to eq(200)
    expect(upload.reload.sha1).to eq(original_sha1)
  end

  it "uses Guest in the cache key for anonymous public downloads" do
    upload = create_upload(filename: "public.png", bytes: png_bytes, content_type: "image/png")
    attach_upload(upload)

    get "/user-download-watermark/uploads/#{upload.id}"

    expect(response.status).to eq(200)
    watermarker = UserDownloadWatermark::Watermarker.new(upload: upload, user: nil, post: post)
    expect(watermarker.cache_key).to include("/#{upload.id}/guest/")
    expect(watermarker.send(:watermark_lines)).to eq(["Tea Time Cari Community", "Guest"])
  end

  it "redirects unsupported file types to the original upload URL" do
    upload = create_upload(filename: "notes.txt", bytes: txt_bytes, content_type: "text/plain")
    attach_upload(upload)
    sign_in(user)

    get "/user-download-watermark/uploads/#{upload.id}"

    expect(response).to redirect_to(upload.url)
  end

  it "does not allow a user without topic access to download a private image" do
    upload = create_upload(filename: "private.png", bytes: png_bytes, content_type: "image/png")
    attach_upload(upload, private_post)
    sign_in(user)

    get "/user-download-watermark/uploads/#{upload.id}"

    expect(response.status).to eq(403)
  end

  it "keeps cache keys separate between users" do
    upload = create_upload(filename: "shared.png", bytes: png_bytes, content_type: "image/png")
    attach_upload(upload)

    first_key = UserDownloadWatermark::Watermarker.new(upload: upload, user: user, post: post).cache_key
    second_key = UserDownloadWatermark::Watermarker.new(upload: upload, user: other_user, post: post).cache_key

    expect(first_key).not_to eq(second_key)
    expect(first_key).to include("/#{user.id}/")
    expect(second_key).to include("/#{other_user.id}/")
  end
end
