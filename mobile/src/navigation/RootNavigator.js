import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import PackagesScreen from '../screens/PackagesScreen';
import BookingsScreen from '../screens/BookingsScreen';
import BookingDetailScreen from '../screens/BookingDetailScreen';
import VoucherScreen from '../screens/VoucherScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const BookingsStackNav = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Simple text-emoji tab icon to avoid extra icon-font setup in the scaffold.
const tabIcon = (glyph) => ({ color }) => <Text style={{ fontSize: 18, color }}>{glyph}</Text>;

const greenHeader = { headerStyle: { backgroundColor: COLORS.greenDark }, headerTintColor: '#fff' };

function BookingsStack() {
  return (
    <BookingsStackNav.Navigator screenOptions={greenHeader}>
      <BookingsStackNav.Screen name="BookingsList" component={BookingsScreen} options={{ title: 'Bookings' }} />
      <BookingsStackNav.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking' }} />
      <BookingsStackNav.Screen name="Voucher" component={VoucherScreen} options={({ route }) => ({ title: `${route.params?.ref || 'Voucher'}` })} />
    </BookingsStackNav.Navigator>
  );
}

function AppTabs() {
  const { can } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.greenDark },
        headerTintColor: '#fff',
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      {can('bookings', 'view') && (
        <Tab.Screen name="Bookings" component={BookingsStack} options={{ headerShown: false, tabBarIcon: tabIcon('📋') }} />
      )}
      {can('packages', 'view') && (
        <Tab.Screen name="Packages" component={PackagesScreen} options={{ tabBarIcon: tabIcon('🧳') }} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: tabIcon('👤') }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.greenDark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="App" component={AppTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
