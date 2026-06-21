import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { I18nManager, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lightweight i18n + RTL. English and Arabic dictionaries cover the high-traffic
// strings; screens can adopt t() incrementally. Switching to Arabic flips the
// layout (RTL) — RN requires an app reload for the mirror to take full effect.
const STRINGS = {
  en: {
    bookings: 'Bookings', packages: 'Packages', profile: 'Profile', customers: 'Customers', fleet: 'Fleet',
    signIn: 'Sign In', signOut: 'Sign Out', email: 'Email', password: 'Password',
    booking: 'Booking', customer: 'Customer', trip: 'Trip', payments: 'Payments', voucher: 'Voucher',
    newBooking: 'New Booking', edit: 'Edit', save: 'Save', cancel: 'Cancel', create: 'Create',
    language: 'Language', tenant: 'Tenant', phone: 'Phone', plan: 'Plan',
    recordPayment: 'Record Payment', payOnline: 'Pay Online', amount: 'Amount', balance: 'Balance',
    addCustomer: 'Add Customer', name: 'Name', company: 'Company', status: 'Status',
    logTrip: 'Log Trip', submitCash: 'Submit Cash', maintenance: 'Maintenance',
  },
  ar: {
    bookings: 'الحجوزات', packages: 'الباقات', profile: 'الملف الشخصي', customers: 'العملاء', fleet: 'الأسطول',
    signIn: 'تسجيل الدخول', signOut: 'تسجيل الخروج', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    booking: 'حجز', customer: 'العميل', trip: 'الرحلة', payments: 'المدفوعات', voucher: 'القسيمة',
    newBooking: 'حجز جديد', edit: 'تعديل', save: 'حفظ', cancel: 'إلغاء', create: 'إنشاء',
    language: 'اللغة', tenant: 'المؤسسة', phone: 'الهاتف', plan: 'الباقة',
    recordPayment: 'تسجيل دفعة', payOnline: 'الدفع عبر الإنترنت', amount: 'المبلغ', balance: 'الرصيد',
    addCustomer: 'إضافة عميل', name: 'الاسم', company: 'الشركة', status: 'الحالة',
    logTrip: 'تسجيل رحلة', submitCash: 'تسليم النقد', maintenance: 'الصيانة',
  },
};

const I18nCtx = createContext({ lang: 'en', t: (k) => k, setLang: () => {} });
export const useI18n = () => useContext(I18nCtx);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem('sm_lang').then((v) => { if (v) setLangState(v); });
  }, []);

  const setLang = useCallback(async (next) => {
    if (next === lang) return;
    await AsyncStorage.setItem('sm_lang', next);
    const wantRTL = next === 'ar';
    setLangState(next);
    if (I18nManager.isRTL !== wantRTL) {
      I18nManager.allowRTL(wantRTL);
      I18nManager.forceRTL(wantRTL);
      Alert.alert('Restart needed', 'Close and reopen the app to fully apply the new layout direction.');
    }
  }, [lang]);

  const t = useCallback((key) => (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key, [lang]);

  return <I18nCtx.Provider value={{ lang, t, setLang }}>{children}</I18nCtx.Provider>;
}
