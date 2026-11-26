
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCsYqSK9WAfNRmgoFP8J4I9NiFYv1o340g",
  authDomain: "banjara-sports-club.firebaseapp.com",
  projectId: "banjara-sports-club",
  storageBucket: "banjara-sports-club.firebasestorage.app",
  messagingSenderId: "1050032005771",
  appId: "1:1050032005771:web:f2ca51234218f9900fea8e",
  measurementId: "G-TPL3KQZ7MS"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
