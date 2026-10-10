import React from 'react';

export interface DateTimePickerEvent {
  type: string;
  nativeEvent: {
    timestamp: number;
    utcOffset: number;
  };
}

export type DateTimePickerChangeEvent = DateTimePickerEvent;

interface DateTimePickerWebProps {
  value?: Date;
  mode?: 'date' | 'time' | 'datetime';
  is24Hour?: boolean;
  onValueChange?: (event: DateTimePickerChangeEvent, date: Date) => void;
  onChange?: (event: DateTimePickerChangeEvent, date?: Date) => void;
  onDismiss?: () => void;
  [key: string]: any;
}

/**
 * Fallback seguro para entorno Web y SSR en Node.
 * Evita llamar componentes nativos Fabric que no existen en react-native-web.
 */
export default function DateTimePickerWeb(_props: DateTimePickerWebProps): React.ReactElement | null {
  return null;
}
