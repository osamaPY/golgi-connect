export type Locale = 'it' | 'en';

export const translations = {
  it: {
    // Navigation
    nav: {
      home: 'Home',
      laundry: 'Lavanderia',
      gym: 'Palestra',
      parcels: 'Pacchi',
      profile: 'Profilo',
      admin: 'Admin',
      logout: 'Esci',
    },
    // Auth
    auth: {
      login: 'Accedi',
      signup: 'Registrati',
      logout: 'Esci',
      username: 'Username',
      password: 'Password',
      roomNumber: 'Numero Stanza',
      firstName: 'Nome',
      lastName: 'Cognome',
      email: 'Email',
      welcomeBack: 'Bentornato',
      loginDescription: 'Accedi con le tue credenziali del collegio',
      usernameFormat: 'Formato: numeroStanza-nome (es. 606-oussama)',
      forgotPassword: 'Password dimenticata?',
      noAccount: 'Non hai un account?',
      hasAccount: 'Hai già un account?',
    },
    // News
    news: {
      title: 'Notizie ed Avvisi',
      pinned: 'In Evidenza',
      readMore: 'Leggi di più',
      noNews: 'Nessuna notizia al momento',
    },
    // Laundry
    laundry: {
      title: 'Prenota Lavanderia',
      washers: 'Lavatrici (LAV)',
      dryers: 'Asciugatrici (ASC)',
      available: 'Disponibile',
      booked: 'Prenotato',
      yourBooking: 'Tua Prenotazione',
      full: 'Completo',
      selectSlot: 'Seleziona uno slot',
      book: 'Prenota',
      cancel: 'Cancella',
      weeklyQuota: 'Quota Settimanale',
      lavUsed: 'LAV utilizzate',
      ascUsed: 'ASC utilizzate',
      maxLav: 'Max 3 LAV/settimana',
      maxAsc: 'Max 2 ASC/settimana',
      rules: 'Regole',
      rule1: 'Massimo 3 LAV e 2 ASC a settimana',
      rule2: 'Non sovrascrivere le prenotazioni altrui',
      rule3: 'NON usare il programma 70 (dura 3 ore)',
      rule4: 'Cancella se non puoi più utilizzare lo slot',
    },
    // Parcels
    parcels: {
      title: 'I Miei Pacchi',
      noParcels: 'Nessun pacco in arrivo',
      arrived: 'Arrivato',
      notified: 'Notificato',
      pickedUp: 'Ritirato',
      carrier: 'Corriere',
      tracking: 'Tracking',
      arrivedAt: 'Arrivato il',
      pickupAt: 'Ritirato il',
    },
    // Common
    common: {
      loading: 'Caricamento...',
      error: 'Errore',
      success: 'Successo',
      cancel: 'Annulla',
      confirm: 'Conferma',
      save: 'Salva',
      delete: 'Elimina',
      edit: 'Modifica',
      close: 'Chiudi',
      search: 'Cerca',
      filter: 'Filtra',
      all: 'Tutti',
    },
  },
  en: {
    // Navigation
    nav: {
      home: 'Home',
      laundry: 'Laundry',
      gym: 'Gym',
      parcels: 'Parcels',
      profile: 'Profile',
      admin: 'Admin',
      logout: 'Logout',
    },
    // Auth
    auth: {
      login: 'Login',
      signup: 'Sign Up',
      logout: 'Logout',
      username: 'Username',
      password: 'Password',
      roomNumber: 'Room Number',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      welcomeBack: 'Welcome Back',
      loginDescription: 'Login with your college credentials',
      usernameFormat: 'Format: roomNumber-firstName (e.g., 606-oussama)',
      forgotPassword: 'Forgot password?',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
    },
    // News
    news: {
      title: 'News & Announcements',
      pinned: 'Pinned',
      readMore: 'Read more',
      noNews: 'No news at the moment',
    },
    // Laundry
    laundry: {
      title: 'Book Laundry',
      washers: 'Washers (LAV)',
      dryers: 'Dryers (ASC)',
      available: 'Available',
      booked: 'Booked',
      yourBooking: 'Your Booking',
      full: 'Full',
      selectSlot: 'Select a slot',
      book: 'Book',
      cancel: 'Cancel',
      weeklyQuota: 'Weekly Quota',
      lavUsed: 'LAV used',
      ascUsed: 'ASC used',
      maxLav: 'Max 3 LAV/week',
      maxAsc: 'Max 2 ASC/week',
      rules: 'Rules',
      rule1: 'Maximum 3 LAV and 2 ASC per week',
      rule2: 'Do not overwrite others\' reservations',
      rule3: 'DO NOT use program 70 (lasts 3 hours)',
      rule4: 'Cancel if you can no longer use the slot',
    },
    // Parcels
    parcels: {
      title: 'My Parcels',
      noParcels: 'No parcels incoming',
      arrived: 'Arrived',
      notified: 'Notified',
      pickedUp: 'Picked Up',
      carrier: 'Carrier',
      tracking: 'Tracking',
      arrivedAt: 'Arrived on',
      pickupAt: 'Picked up on',
    },
    // Common
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      search: 'Search',
      filter: 'Filter',
      all: 'All',
    },
  },
};

export const useTranslation = (locale: Locale = 'it') => {
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[locale];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };

  return { t, locale };
};
