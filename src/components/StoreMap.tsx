import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';

import { useT } from '../i18n';
import { colors, radius, spacing } from '../theme';
import { StoreMarker } from './StoreMarker';
import { VIENNA_REGION, type StoreMapProps } from './storeMapTypes';

/**
 * Vienna map with one custom marker per branch.
 *
 * With the real OpenStreetMap dataset the city has several hundred branches, so
 * only the ones inside the current viewport are mounted, capped at
 * `MAX_MARKERS`. `tracksViewChanges={false}` keeps the custom marker views cheap
 * once they are drawn.
 */
const MAX_MARKERS = 120;

export const StoreMap: React.FC<StoreMapProps> = ({ items, selectedStoreId, onSelectStore }) => {
  const [region, setRegion] = useState<Region>(VIENNA_REGION);
  const t = useT();

  const { visible, hidden } = useMemo(() => {
    const latPadding = region.latitudeDelta * 0.6;
    const lngPadding = region.longitudeDelta * 0.6;
    const inView = items.filter(
      ({ store }) =>
        Math.abs(store.lat - region.latitude) <= latPadding &&
        Math.abs(store.lng - region.longitude) <= lngPadding,
    );
    // when zoomed far out, keep the branches closest to the centre of the screen
    const sorted =
      inView.length > MAX_MARKERS
        ? inView
            .slice()
            .sort(
              (a, b) =>
                Math.hypot(a.store.lat - region.latitude, a.store.lng - region.longitude) -
                Math.hypot(b.store.lat - region.latitude, b.store.lng - region.longitude),
            )
        : inView;
    return { visible: sorted.slice(0, MAX_MARKERS), hidden: Math.max(0, inView.length - MAX_MARKERS) };
  }, [items, region]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={VIENNA_REGION}
        onRegionChangeComplete={setRegion}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
      >
        {visible.map(({ store, retailer }) => (
          <Marker
            key={store.id}
            identifier={store.id}
            coordinate={{ latitude: store.lat, longitude: store.lng }}
            onPress={() => onSelectStore(store.id)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
          >
            <StoreMarker retailer={retailer} selected={selectedStoreId === store.id} />
          </Marker>
        ))}
      </MapView>

      {hidden > 0 ? (
        <View style={styles.zoomHint} pointerEvents="none">
          <Text style={styles.zoomHintText}>{t('map.zoomHint', { count: hidden })}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  zoomHint: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  zoomHintText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
