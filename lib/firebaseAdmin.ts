import * as admin from 'firebase-admin'

let app: admin.app.App | null = null

export function getAdminApp(): admin.app.App {
  if (app) return app

  // Avoid re-initializing if already initialized (e.g. hot reload in dev)
  if (admin.apps.length > 0) {
    app = admin.apps[0]!
    return app
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin environment variables. ' +
        'Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    )
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      // Newlines are escaped in .env — restore them here
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  })

  return app
}

export function getAdminFirestore(): admin.firestore.Firestore {
  return getAdminApp().firestore()
}

export function getAdminAuth(): admin.auth.Auth {
  return getAdminApp().auth()
}
