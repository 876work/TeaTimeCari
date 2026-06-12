# frozen_string_literal: true

module ::UserDownloadWatermark
  class Engine < ::Rails::Engine
    engine_name UserDownloadWatermark::PLUGIN_NAME
    isolate_namespace UserDownloadWatermark

    routes.draw do
      get "/uploads/by-url" => "downloads#show"
      get "/uploads/:upload_id" => "downloads#show", constraints: { upload_id: /\d+/ }
    end
  end
end
