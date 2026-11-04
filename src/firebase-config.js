// Pocket Farm Firebase config. Only values go here: no import lines, no initializeApp().
// (The game's src/firebase.js loads Firebase and calls initializeApp for you.)
export const firebaseConfig = {
  apiKey: 'AIzaSyC6oITmosWoLRKgWswQtht-r5E4dl9opTc',
  authDomain: 'pocketfarm-14eb7.firebaseapp.com',
  projectId: 'pocketfarm-14eb7',
  storageBucket: 'pocketfarm-14eb7.firebasestorage.app',
  messagingSenderId: '430815958197',
  appId: '1:430815958197:web:65953fe4ca0f114502dafc',
};

export const isConfigured = !firebaseConfig.apiKey.startsWith('PASTE');
