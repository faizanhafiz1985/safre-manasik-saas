import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n';
import { COLORS } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PackagesScreen from '../screens/PackagesScreen';
import BookingsScreen from '../screens/BookingsScreen';
import BookingDetailScreen from '../screens/BookingDetailScreen';
import BookingFormScreen from '../screens/BookingFormScreen';
import VoucherScreen from '../screens/VoucherScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import FleetScreen from '../screens/FleetScreen';
import MoreHubScreen from '../screens/MoreHubScreen';
import DirectVouchersScreen from '../screens/DirectVouchersScreen';
import DirectVoucherDetailScreen from '../screens/DirectVoucherDetailScreen';
import DirectVoucherFormScreen from '../screens/DirectVoucherFormScreen';
import PrintWebViewScreen from '../screens/PrintWebViewScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const BookingsStackNav = createNativeStackNavigator();
const MoreStackNav = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabIcon = (glyph) => ({ color }) => <Text style={{ fontSize: 18, color }}>{glyph}</Text>;
const green = { headerStyle: { backgroundColor: COLORS.greenDark }, headerTintColor: '#fff' };

function BookingsStack() {
  const { t } = useI18n();
  return (
    <BookingsStackNav.Navigator screenOptions={green}>
      <BookingsStackNav.Screen name="BookingsList" component={BookingsScreen} options={{ title: t('bookings') }} />
      <BookingsStackNav.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: t('booking') }} />
      <BookingsStackNav.Screen name="BookingForm" component={BookingFormScreen} options={{ title: t('newBooking') }} />
      <BookingsStackNav.Screen name="Payments" component={PaymentsScreen} options={{ title: t('payments') }} />
      <BookingsStackNav.Screen name="Voucher" component={VoucherScreen} options={({ route }) => ({ title: route.params?.ref || t('voucher') })} />
    </BookingsStackNav.Navigator>
  );
}

function MoreStack() {
  const { t } = useI18n();
  return (
    <MoreStackNav.Navigator screenOptions={green}>
      <MoreStackNav.Screen name="MoreHub" component={MoreHubScreen} options={{ title: t('more') }} />
      <MoreStackNav.Screen name="DirectVouchers" component={DirectVouchersScreen} options={{ title: t('directVouchers') }} />
      <MoreStackNav.Screen name="DirectVoucherDetail" component={DirectVoucherDetailScreen} options={{ title: t('voucher') }} />
      <MoreStackNav.Screen name="DirectVoucherForm" component={DirectVoucherFormScreen} options={{ title: t('newBooking') }} />
      <MoreStackNav.Screen name="Packages" component={PackagesScreen} options={{ title: t('packages') }} />
      <MoreStackNav.Screen name="Customers" component={CustomersScreen} options={{ title: t('customers') }} />
      <MoreStackNav.Screen name="Fleet" component={FleetScreen} options={{ title: t('fleet') }} />
      <MoreStackNav.Screen name="PrintWebView" component={PrintWebViewScreen} options={({ route }) => ({ title: route.params?.title || t('voucher') })} />
    </MoreStackNav.Navigator>
  );
}

function AppTabs() {
  const { can } = useAuth();
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{ ...green, tabBarActiveTintColor: COLORS.green, tabBarInactiveTintColor: COLORS.textMuted }}
    >
      {can('dashboard', 'view') && (
        <Tab.Screen name="Home" component={DashboardScreen} options={{ title: t('home'), tabBarLabel: t('home'), tabBarIcon: tabIcon('🏠') }} />
      )}
      {can('bookings', 'view') && (
        <Tab.Screen name="Bookings" component={BookingsStack} options={{ headerShown: false, tabBarLabel: t('bookings'), tabBarIcon: tabIcon('📋') }} />
      )}
      <Tab.Screen name="More" component={MoreStack} options={{ headerShown: false, tabBarLabel: t('more'), tabBarIcon: tabIcon('☰') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('profile'), tabBarLabel: t('profile'), tabBarIcon: tabIcon('👤') }} />
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
        {user ? <Stack.Screen name="App" component={AppTabs} /> : <Stack.Screen name="Login" component={LoginScreen} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
