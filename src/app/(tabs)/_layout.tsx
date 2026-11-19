import { useEffect } from 'react';
import { Platform, Image } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { Tabs } from 'expo-router';

import { Fonts } from '@/constants/theme';

export default function TabLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync('#4A2E18').catch(() => {});
    }
  }, []);

  return (
    <>
      <NavigationBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#D4AF37',
          tabBarInactiveTintColor: '#C4B59D',
          tabBarStyle: {
            backgroundColor: '#4A2E18',
            borderTopColor: 'rgba(212, 175, 55, 0.16)',
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: Fonts.mono,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color }) => (
              <Image
                source={require('@/assets/images/tabIcons/home.png')}
                style={{ width: 24, height: 24, tintColor: color }}
                resizeMode="contain"
              />
            ),
          }}
        />

        <Tabs.Screen
          name="historial"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color }) => (
              <Image
                source={require('@/assets/images/tabIcons/ticket.png')}
                style={{ width: 24, height: 24, tintColor: color }}
                resizeMode="contain"
              />
            ),
          }}
        />

        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color }) => (
              <Image
                source={require('@/assets/images/tabIcons/profile.png')}
                style={{ width: 24, height: 24, tintColor: color }}
                resizeMode="contain"
              />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
