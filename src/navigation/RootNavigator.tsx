import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import React from 'react';

import { DiscountsScreen } from '../screens/DiscountsScreen';
import { KulinarikScreen } from '../screens/KulinarikScreen';
import { MapScreen } from '../screens/MapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useT } from '../i18n';
import { colors } from '../theme';

export type RootTabParamList = {
  Karte: undefined;
  Rabatte: undefined;
  Kulinarik: undefined;
  Profil: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const icons: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Karte: 'map-outline',
  Rabatte: 'pricetags-outline',
  Kulinarik: 'restaurant-outline',
  Profil: 'person-outline',
};

/** The four sections of the app, as a bottom tab bar. */
const TAB_LABELS = {
  Karte: 'tab.map',
  Rabatte: 'tab.discounts',
  Kulinarik: 'tab.kitchen',
  Profil: 'tab.profile',
} as const;

export const RootNavigator: React.FC = () => {
  const t = useT();

  return (
  <NavigationContainer>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabel: t(TAB_LABELS[route.name]),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Karte" component={MapScreen} />
      <Tab.Screen name="Rabatte" component={DiscountsScreen} />
      <Tab.Screen name="Kulinarik" component={KulinarikScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  </NavigationContainer>
  );
};
