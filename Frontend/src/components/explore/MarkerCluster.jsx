import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { categoryConfig, displayType } from "../../utils/categories";

/**
 * Clustered, category-coloured markers.
 *
 * Built directly on leaflet.markercluster rather than a React wrapper:
 * the wrappers lag behind react-leaflet releases, and driving the plugin
 * through `useMap` is both smaller and stable across versions.
 *
 * Markers are created imperatively and kept in a ref keyed by placeId so
 * selecting a result only restyles the one marker involved, instead of
 * tearing down and rebuilding the whole layer on every click.
 */
function pinIcon(place, selected, animate) {
  const config = categoryConfig(displayType(place));
  const size = selected ? 42 : 32;
  const inner = selected ? 18 : 14;

  return L.divIcon({
    className: "",
    html: `
      <div class="${animate ? "lf-marker-enter" : ""}" style="width:${size}px;height:${size}px;">
        <div style="
          width:${size}px;height:${size}px;
          background:${config.pin};
          border:3px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
          box-shadow:${selected ? `0 0 0 6px ${config.pin}33, 0 6px 18px rgba(15,23,42,.35)` : "0 3px 10px rgba(15,23,42,.3)"};
          transition:box-shadow .2s ease;
        ">
          <div style="transform:rotate(45deg);width:${inner}px;height:${inner}px;color:#fff;">
            ${config.svg || ""}
          </div>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size - 2],
  });
}

export default function MarkerCluster({ places = [], selectedId = null, onSelect, enabled = true }) {
  const map = useMap();
  const groupRef = useRef(null);
  const markersRef = useRef(new Map());
  const seenRef = useRef(new Set());

  // The layer group is created once and reused for the life of the map.
  const group = useMemo(() => {
    if (!enabled) return L.layerGroup();
    return L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 52,
      disableClusteringAtZoom: 17,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 34 : count < 50 ? 42 : 50;
        return L.divIcon({
          html: `<div class="lf-cluster" style="width:${size}px;height:${size}px;font-size:${size > 40 ? 14 : 12}px;">${count}</div>`,
          className: "",
          iconSize: [size, size],
        });
      },
    });
  }, [enabled]);

  useEffect(() => {
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      markersRef.current.clear();
    };
  }, [map, group]);

  // Reconcile markers against the current result set.
  useEffect(() => {
    const layer = groupRef.current;
    if (!layer) return;

    const nextIds = new Set(places.map((place) => place.placeId));

    for (const [id, marker] of markersRef.current.entries()) {
      if (!nextIds.has(id)) {
        layer.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    const added = [];
    for (const place of places) {
      if (markersRef.current.has(place.placeId)) continue;
      // Only animate a pin the first time it is seen, so panning the map
      // does not replay the drop animation on markers already on screen.
      const isNew = !seenRef.current.has(place.placeId);
      seenRef.current.add(place.placeId);

      const marker = L.marker([place.lat, place.lng], {
        icon: pinIcon(place, place.placeId === selectedId, isNew),
        title: place.name,
        keyboard: true,
        alt: place.name,
      });
      marker.on("click", () => onSelect?.(place));
      markersRef.current.set(place.placeId, marker);
      added.push(marker);
    }

    if (added.length > 0) {
      if (layer.addLayers) layer.addLayers(added);
      else added.forEach((marker) => layer.addLayer(marker));
    }

    if (import.meta.env.DEV) {
      const byCategory = {};
      for (const place of places) {
        const key = displayType(place) || "unknown";
        byCategory[key] = (byCategory[key] || 0) + 1;
      }
      // Markers are built from exactly the array the list renders, so these
      // counts must always agree with the sidebar. If they ever diverge,
      // the two views have been fed different data.
      console.debug(
        `[markers] rendering ${markersRef.current.size} pins for ${places.length} results`,
        byCategory
      );
    }
  }, [places, onSelect, selectedId]);

  // Restyle only the markers whose selected state actually changed.
  const previousSelected = useRef(null);
  useEffect(() => {
    const previous = previousSelected.current;
    if (previous && previous !== selectedId) {
      const marker = markersRef.current.get(previous);
      const place = places.find((item) => item.placeId === previous);
      if (marker && place) marker.setIcon(pinIcon(place, false, false));
    }
    if (selectedId) {
      const marker = markersRef.current.get(selectedId);
      const place = places.find((item) => item.placeId === selectedId);
      if (marker && place) {
        marker.setIcon(pinIcon(place, true, false));
        marker.setZIndexOffset(1000);
      }
    }
    previousSelected.current = selectedId;
  }, [selectedId, places]);

  return null;
}
