# VideoApp

A single-page download screen for the VideoApp APK. It keeps the original preview video, the `/download` link, and the 18+ notice, with a clearer layout for phone and desktop.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. The page is `index.html`. Admin is `admin.html`.

## Admin

The password is `Test123` until you change it under Password.

Visitors has a search box for IP, city, device, button, or date. View opens the full visit.

Password → Google Authenticator can be turned on or off. Scan the QR in the Google Authenticator app. While it is on, login needs the password and the current 6-digit code. Turn it off with a current code from the app. Changing the password does not turn it off.

## Your files

- The download button goes to `/download`. Point that path at your APK on the server that hosts this page.
- The preview video is the one saved in Admin → Videos. A YouTube link or an uploaded mp4 starts as soon as the page opens.
