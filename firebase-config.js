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
    apiKey: "AIzaSyAOfciF3d0D0ebFxq2KrH7-SsfK8rRElbg",
    authDomain: "boxes-ffa31.firebaseapp.com",
    projectId: "boxes-ffa31",
    storageBucket: "boxes-ffa31.firebasestorage.app",
    messagingSenderId: "262406319054",
    appId: "1:262406319054:web:85564856a604f8b766d99f"
};

// Check if Firebase is configured
const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey !== "YOUR_API_KEY";
};

export { firebaseConfig, isFirebaseConfigured };
