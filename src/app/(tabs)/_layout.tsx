import { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

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
      <NativeTabs
      backgroundColor="#4A2E18"
      indicatorColor="rgba(212, 175, 55, 0.16)"
      tintColor="#D4AF37"
      iconColor={{
        default: '#C4B59D',
        selected: '#D4AF37',
      }}
      labelStyle={{
        default: {
          color: '#C4B59D',
          fontSize: 10,
          fontFamily: Fonts.mono,
        },
        selected: {
          color: '#D4AF37',
          fontSize: 10,
          fontWeight: '700',
          fontFamily: Fonts.mono,
        },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="historial">
        <NativeTabs.Trigger.Label>Historial</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/ticket.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/profile.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
    </>
  );
}
