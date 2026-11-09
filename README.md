# THRUST LEGION ADVENTURES KENYA

A responsive public website for showcasing activities, with a Firebase-backed admin area for the two authorized phone numbers. Visitors can browse listings and enquire through WhatsApp. Admins can add, edit, and remove activities after signing in with an SMS verification code.

## Repository contents

- `index.html` — public website and admin interface
- `styles.css` — responsive visual design
- `app.js` — Firebase phone authentication and Firestore activity management
- `firestore.rules` — public reads; writes restricted to the two verified admin phone numbers
- `firebase.json` — Firebase Hosting and Firestore rules configuration

## Set up the live website

The source is in GitHub, but it is not publicly hosted until you connect a Firebase project and deploy it. Firebase setup requires an account/project and project-specific settings; none are included in this repository.

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/) and register a Web App.
2. In Firebase Console, enable **Authentication → Phone**. Set up billing/usage as required by Firebase for SMS verification.
3. Add the website domain you will use (and `localhost` for local testing) to Authentication's **Authorized domains**. Configure reCAPTCHA as required by Firebase Phone Auth.
4. Create a **Cloud Firestore** database.
5. Copy the web app settings into the `firebaseConfig` object near the top of `app.js` (`apiKey`, `authDomain`, `projectId`, `appId`). These are Firebase client settings, not admin credentials. Do not put service-account private keys in browser code.
6. Install the Firebase CLI, sign in, and select your project:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add
   ```

7. Deploy Firestore rules and the site from the repository directory:

   ```bash
   firebase deploy --only firestore:rules,hosting
   ```

8. Test sign-in on both authorized phones. Enter them in international format: `+254700659586` and `+254790840890`. Other numbers are rejected by the site and cannot write to Firestore under the included rules.

Firebase may require a billing-enabled plan or additional anti-abuse setup for phone authentication. Check the current Firebase console guidance for your project.

## Activities and contacts

The public WhatsApp contacts are **+254 700 659 586** and **+254 790 840 890**. Public activity cards start with sample/promotional placeholders until Firebase is connected; replace them by publishing real activities in the Admin panel. The email contact is `thrustlegionadventureske@gmail.com`.

Use the small **Admin** button at the bottom right to open the manager. The two allowed phone numbers can publish, edit, or delete activities. Visitors can read published listings without signing in.

## Security notes

- Firestore rules are the actual write authorization boundary; the client-side allowlist alone is not security.
- The current rules allow public reads of activity records because activities are displayed publicly. Do not put personal or confidential data in an activity.
- Phone-number verification relies on Firebase Authentication. Keep the two authorized numbers current in both `app.js` and `firestore.rules` if they change.
- Firebase client configuration is intended to be public. Never add service-account keys or other server secrets to this repository.
