import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { StoreMarker } from './StoreMarker';
import { VIENNA_REGION, type StoreMapProps } from './storeMapTypes';

/**
 * Vienna map with one custom marker per branch.
 * `tracksViewChanges={false}` keeps the custom marker views cheap once drawn.
 */
export const StoreMap: React.FC<StoreMapProps> = ({ items, selectedStoreId, onSelectStore }) => (
  <MapView
    style={styles.map}
    provider={PROVIDER_DEFAULT}
    initialRegion={VIENNA_REGION}
    showsPointsOfInterests={false}
    toolbarEnabled={false}
  >
    {items.map(({ store, retailer, offerCount }) => (
      <Marker
        key={store.id}
        identifier={store.id}
        coordinate={{ latitude: store.lat, longitude: store.lng }}
        onPress={() => onSelectStore(store.id)}
        tracksViewChanges={false}
        anchor={{ x: 0.5, y: 1 }}
      >
        <StoreMarker
          retailer={retailer}
          offerCount={offerCount}
          selected={selectedStoreId === store.id}
        />
      </Marker>
    ))}
  </MapView>
);

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
