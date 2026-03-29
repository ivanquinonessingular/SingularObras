import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBzrVvOwa0-qteVl1r3ObYaMjkoLAsad88",
  authDomain: "singular-proyectos.firebaseapp.com",
  projectId: "singular-proyectos",
  storageBucket: "singular-proyectos.firebasestorage.app",
  messagingSenderId: "353773989324",
  appId: "1:353773989324:web:a4927c26743032664bc169",
  measurementId: "G-R9SQ95RK2R"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
