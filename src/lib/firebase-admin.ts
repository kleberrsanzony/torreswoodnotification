import * as admin from 'firebase-admin';

export function getAdminMessaging() {
  if (!admin.apps.length) {
    try {
      if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.warn('Firebase env not found, skipping init during build');
        return null; // Return null during build to avoid crash
      }
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error) {
      console.error('Firebase Admin Error:', error);
      return null;
    }
  }
  return admin.messaging();
}
