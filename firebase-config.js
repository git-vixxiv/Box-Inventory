/**
 * Firebase Configuration
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing)
 * 3. Add a web app to your project
 * 4. Copy the firebaseConfig values below
 * 5. Enable Authentication > Google sign-in
 * 6. Enable Firestore Database (start in test mode, then add rules)
 *
 * FIRESTORE RULES (paste in Firebase Console > Firestore > Rules):
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /users/{userId}/{document=**} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *   }
 * }
 */

const firebaseConfig = {
    apiKey: "AIzaSyAYTuRroX_0vG_V3t7p-_Zc9Xx7KJtHu6o",
    authDomain: "boxes-7f150.firebaseapp.com",
    projectId: "boxes-7f150",
    storageBucket: "boxes-7f150.firebasestorage.app",
    messagingSenderId: "551340403590",
    appId: "1:551340403590:web:da698942de5bde0e8e9a07"
};

// Check if Firebase is configured
const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey !== "YOUR_API_KEY";
};

export { firebaseConfig, isFirebaseConfigured };
