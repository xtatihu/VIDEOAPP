# VideoApp

A single-page download screen for the VideoApp APK. It keeps the original preview video, the `/download` link, and the 18+ notice, with a clearer layout for phone and desktop.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. The page is `index.html`. Admin is `admin.html`.

## Admin

Sign in with username `admin` and password `Test123` until you change them under Account. You can change the username, the password, or both. Reset does not change them.

Visitors lists the newest visit first, with a number, search, View, and Delete.

APK → Auto update stores one future APK with a date and time. The current APK keeps downloading until that time, then the landing page switches to the new file.

History lists sign-ins, username and password changes, Authenticator, uploads, auto updates, videos, downloads, visits, deleted rows, and page-text saves, newest first.

Account → Google Authenticator can be turned on or off. Scan the QR in the Google Authenticator app. While it is on, login needs the username, the password, and the current 6-digit code. Turn it off with a current code from the app.

History scrolls, and each row can be deleted. Visits, history, the account, the APK library, and the download count are encrypted on disk. Admin lists open only after sign-in. Right-click and the inspect shortcuts are blocked on the landing page and in admin; the browser can still show a page it has loaded.

## Your files

- The download button goes to `/download`. Point that path at your APK on the server that hosts this page.
- The preview video is the one saved in Admin → Videos. A YouTube link starts in the player. An uploaded mp4 is prepared so the landing page shows its thumbnail at once and the video starts without waiting for the whole file.
- Videos → Download screen can be turned on or off. When it is on, that card covers the video after the chosen seconds and its own label, title, and line. When it is off, the video keeps playing. The download button under the video stays.
