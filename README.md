# VideoApp

A single-page download screen for the VideoApp APK. It keeps the original preview video, the `/download` link, and the 18+ notice, with a clearer layout for phone and desktop.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. The page is `index.html`.

## Your files

- The download button goes to `/download`. Point that path at your APK on the server that hosts this page.
- The preview clip uses the signed video URL from the original file. If that link has expired, the page shows a poster instead of a broken player. Replace the `<source src>` in `index.html` with a fresh video URL.
