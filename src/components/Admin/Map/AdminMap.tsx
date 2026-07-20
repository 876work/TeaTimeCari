import React from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer } from 'react-leaflet';

interface AdminMapProps {
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  className?: string;
  children?: React.ReactNode;
}

// Default view frames the Caribbean, Americas, Europe, and Africa — where
// the community is concentrated — while still showing the whole world.
const DEFAULT_CENTER: [number, number] = [22, -40];

export function AdminMap({
  center = DEFAULT_CENTER,
  zoom = 2,
  minZoom = 1,
  className,
  children,
}: AdminMapProps) {
  return (
    // z-0 creates a stacking context so Leaflet's internal panes (z-index
    // 400–700) can't float above the admin shell's sticky header and nav.
    <div
      className={`relative z-0 overflow-hidden rounded-2xl border border-white/15 ${className ?? 'h-[28rem]'}`}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={minZoom}
        worldCopyJump
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {children}
      </MapContainer>
    </div>
  );
}
