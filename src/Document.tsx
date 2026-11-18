import { HydrationScript } from '@solidjs/web'
import type { ParentProps } from 'solid-js'

// Applies the stored theme before first paint (no flash). Same storage key
// and attribute contract as the React app's useThemeMode.
const THEME_INIT = `(function(){try{var m=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=m==='light'||m==='dark'?m:(d?'dark':'light');if(m==='light'||m==='dark')document.documentElement.setAttribute('data-theme',m);document.documentElement.style.colorScheme=r;}catch(e){}})();`

export default function Document(props: ParentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <title>Liam Pulsifer (Solid)</title>
        <script innerHTML={THEME_INIT} />
        <HydrationScript />
      </head>
      <body class="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(59,130,246,0.24)]">
        {props.children}
      </body>
    </html>
  )
}
