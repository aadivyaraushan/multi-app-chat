import { createContext, useContext } from 'react';

export interface Theme {
  bg: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  accent: string;
  bubbleMe: string;
  bubbleMeText: string;
  bubbleThem: string;
  bubbleThemText: string;
  unread: string;
  danger: string;
  chipBg: string;
  chipActiveBg: string;
  chipActiveText: string;
}

export const lightTheme: Theme = {
  bg: '#FFFFFF',
  surface: '#F7F7F8',
  surfaceRaised: '#FFFFFF',
  text: '#111114',
  textSecondary: '#6B6B72',
  textTertiary: '#9A9AA1',
  border: '#E7E7EA',
  accent: '#3A6FF8',
  bubbleMe: '#3A6FF8',
  bubbleMeText: '#FFFFFF',
  bubbleThem: '#F0F0F3',
  bubbleThemText: '#111114',
  unread: '#3A6FF8',
  danger: '#E5484D',
  chipBg: '#F0F0F3',
  chipActiveBg: '#111114',
  chipActiveText: '#FFFFFF',
};

export const darkTheme: Theme = {
  bg: '#0E0E11',
  surface: '#17171B',
  surfaceRaised: '#1E1E24',
  text: '#F2F2F5',
  textSecondary: '#A2A2AB',
  textTertiary: '#6E6E77',
  border: '#26262C',
  accent: '#5B8CFF',
  bubbleMe: '#3A6FF8',
  bubbleMeText: '#FFFFFF',
  bubbleThem: '#22222A',
  bubbleThemText: '#F2F2F5',
  unread: '#5B8CFF',
  danger: '#FF6369',
  chipBg: '#22222A',
  chipActiveBg: '#F2F2F5',
  chipActiveText: '#111114',
};

export const ThemeContext = createContext<Theme>(lightTheme);
export const useTheme = () => useContext(ThemeContext);
