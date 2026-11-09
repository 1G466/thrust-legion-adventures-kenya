import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Add your Firebase web app settings here. See README.md for setup instructions.
const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  appId: 'YOUR_FIREBASE_APP_ID'
};
const ADMIN_PHONES = ['+254700659586', '+254790840890'];
const configured = !Object.values(firebaseConfig).some(value => value.startsWith('YOUR_'));
const grid = document.querySelector('#activity-grid');
const emptyState = document.querySelector('#empty-state');
const statusMessage = document.querySelector('#status-message');
const dialog = document.querySelector('#admin-dialog');
const adminMessage = document.querySelector('#admin-message');
const loginForm = document.querySelector('#login-form');
const codeForm = document.querySelector('#code-form');
const editor = document.querySelector('#editor');
let auth, db, confirmation, recaptcha, activityCache = [];

const samples = [
  { id: 'sample-hike', title: 'Find your trail', location: 'Kenya', date: 'Ask us for upcoming dates', price: '', tag: 'Outdoors', description: 'From scenic walks to rewarding climbs, your next trail is waiting. Message our team to find an upcoming trip.', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1000&q=80' },
  { id: 'sample-wild', title: 'Get closer to wild', location: 'Kenya', date: 'Ask us for upcoming dates', price: '', tag: 'Explore', description: 'Make a day of it with fresh air, beautiful landscapes, and good company. Get in touch to plan your adventure.', image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1000&q=80' },
  { id: 'sample-together', title: 'Make it a group day', location: 'Kenya', date: 'Plan a date with us', price: '', tag: 'Groups', description: 'Bring your friends, family, or team together for a memorable day out. Tell us what you have in mind.', image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=80' }
];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function showMessage(text, isError = false) {
  adminMessage.textContent = text;
  adminMessage.classList.toggle('error', isError);
}
function renderActivities(items) {
  grid.replaceChildren();
  emptyState.hidden = items.length > 0;
  items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'activity-card';
    const image = item.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80';
    const title = encodeURIComponent(item.title || 'an activity');
    card.innerHTML = `<div class="activity-photo"><img src="${escapeHtml(image)}" alt="${escapeHtml(item.title)}" loading="lazy"><span class="activity-tag">${escapeHtml(item.tag || 'Adventure')}</span></div><div class="activity-body"><p class="activity-location">${escapeHtml(item.location || 'Kenya')}</p><h3>${escapeHtml(item.title)}</h3><p class="activity-description">${escapeHtml(item.description)}</p><div class="activity-meta"><span>${escapeHtml(item.date || 'Contact us for dates')}</span><strong>${escapeHtml(item.price || '')}</strong><a href="https://wa.me/254700659586?text=${title}" target="_blank" rel="noopener noreferrer">Enquire ↗</a></div></div>`;
    grid.append(card);
  });
}
function canManage(user) { return Boolean(user && ADMIN_PHONES.includes(user.phoneNumber)); }
async function loadActivities() {
  if (!configured) {
    renderActivities(samples);
    statusMessage.textContent = 'Sample cards shown. Published activity listings appear here after Firebase is connected.';
    return;
  }
  try {
    const snapshot = await getDocs(query(collection(db, 'activities'), orderBy('createdAt', 'desc')));
    const items = snapshot.docs.map(record => ({ id: record.id, ...record.data() }));
    renderActivities(items);
  } catch (error) {
    console.error(error);
    renderActivities([]);
    statusMessage.textContent = 'Activities could not be loaded. Please try again later or contact our team on WhatsApp.';
  }
}
function renderManageList() {
  const list = document.querySelector('#manage-list');
  list.replaceChildren();
  if (!activityCache.length) { list.innerHTML = '<p class="form-message">No activities published yet.</p>'; return; }
  activityCache.forEach(item => {
    const row = document.createElement('div'); row.className = 'manage-item';
    row.innerHTML = `<div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.location)} · ${escapeHtml(item.date || 'No date')}</small></div><div class="manage-actions"><button type="button" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button><button type="button" class="delete-button" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button></div>`;
    list.append(row);
  });
}
async function refreshManageList() {
  if (!canManage(auth.currentUser)) return;
  const snapshot = await getDocs(query(collection(db, 'activities'), orderBy('createdAt', 'desc')));
  activityCache = snapshot.docs.map(record => ({ id: record.id, ...record.data() }));
  renderManageList();
}
function resetActivityForm() {
  document.querySelector('#activity-form').reset();
  document.querySelector('#activity-id').value = '';
  document.querySelector('#activity-form button[type="submit"]').innerHTML = 'Publish activity <span>↗</span>';
  document.querySelector('#cancel-edit').hidden = true;
}
if (configured) {
  try {
    const app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app);
    onAuthStateChanged(auth, async user => {
      const allowed = canManage(user);
      loginForm.hidden = allowed;
      codeForm.hidden = true;
      editor.hidden = !allowed;
      document.querySelector('#admin-config-note').hidden = true;
      if (allowed) {
        document.querySelector('#signed-in-as').textContent = `Signed in as ${user.phoneNumber}`;
        showMessage('');
        try { await refreshManageList(); } catch (error) { showMessage('Could not load activities. Check your connection and try again.', true); }
      } else if (user) {
        showMessage('This phone number is not authorized to manage activities.', true);
        await signOut(auth);
      }
    });
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    document.querySelector('#admin-config-note').hidden = false;
  }
} else {
  document.querySelector('#admin-config-note').hidden = false;
}

renderActivities(samples);
loadActivities();
document.querySelector('#year').textContent = new Date().getFullYear();
document.querySelector('#admin-open').addEventListener('click', () => dialog.showModal());
document.querySelector('#admin-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!configured || !auth) { showMessage('Admin sign-in is not configured yet. See the repository README.', true); return; }
  const phone = document.querySelector('#phone-number').value.replace(/[\s()-]/g, '');
  if (!ADMIN_PHONES.includes(phone)) { showMessage('That phone number is not one of the two authorized admins.', true); return; }
  try {
    if (!recaptcha) recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'normal' });
    confirmation = await signInWithPhoneNumber(auth, phone, recaptcha);
    loginForm.hidden = true; codeForm.hidden = false; showMessage('Verification code sent. Check your phone.');
  } catch (error) {
    console.error(error); showMessage(error.message || 'Could not send verification code. Check Firebase phone sign-in setup.', true);
    if (recaptcha) { recaptcha.clear(); recaptcha = null; }
  }
});
codeForm.addEventListener('submit', async event => {
  event.preventDefault();
  try { await confirmation.confirm(document.querySelector('#verification-code').value.trim()); showMessage('Phone verified.'); }
  catch (error) { console.error(error); showMessage('That code could not be verified. Please try again.', true); }
});
document.querySelector('#sign-out').addEventListener('click', async () => { await signOut(auth); showMessage('You have signed out.'); });
document.querySelector('#activity-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!canManage(auth?.currentUser)) { showMessage('Please sign in with an authorized admin phone first.', true); return; }
  const values = {
    title: document.querySelector('#activity-title').value.trim(), location: document.querySelector('#activity-location').value.trim(),
    date: document.querySelector('#activity-date').value.trim(), price: document.querySelector('#activity-price').value.trim(),
    tag: document.querySelector('#activity-tag').value.trim() || 'Adventure', image: document.querySelector('#activity-image').value.trim(),
    description: document.querySelector('#activity-description').value.trim()
  };
  const id = document.querySelector('#activity-id').value;
  try {
    if (id) await updateDoc(doc(db, 'activities', id), { ...values, updatedAt: serverTimestamp() });
    else await addDoc(collection(db, 'activities'), { ...values, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    resetActivityForm(); await refreshManageList(); await loadActivities(); showMessage(id ? 'Activity updated.' : 'Activity published.');
  } catch (error) { console.error(error); showMessage('Could not save this activity. Please check your connection and Firestore rules.', true); }
});
document.querySelector('#cancel-edit').addEventListener('click', resetActivityForm);
document.querySelector('#manage-list').addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const item = activityCache.find(entry => entry.id === button.dataset.id); if (!item) return;
  if (button.dataset.action === 'edit') {
    document.querySelector('#activity-id').value = item.id;
    for (const [field, key] of [['activity-title','title'],['activity-location','location'],['activity-date','date'],['activity-price','price'],['activity-tag','tag'],['activity-image','image'],['activity-description','description']]) document.getElementById(field).value = item[key] || '';
    document.querySelector('#activity-form button[type="submit"]').innerHTML = 'Save changes <span>↗</span>';
    document.querySelector('#cancel-edit').hidden = false; document.querySelector('#activity-title').focus();
  } else if (confirm(`Delete “${item.title}”? This cannot be undone.`)) {
    try { await deleteDoc(doc(db, 'activities', item.id)); await refreshManageList(); await loadActivities(); showMessage('Activity deleted.'); }
    catch (error) { console.error(error); showMessage('Could not delete this activity.', true); }
  }
});
