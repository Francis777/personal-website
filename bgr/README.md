# BGR apps

This directory contains the two self-contained Vite applications published from the website's /bgr/ landing page:

- bg_housing builds to /bgr/housing/.
- bg_wine builds to /bgr/wine/.

The Jekyll build creates the landing page first. The BGR build then writes both static applications into \_site/bgr/. Run the following commands from the website root:

    npm run install:bgr
    bundle exec jekyll build
    npm run build:bgr

GitHub Pages cannot run the housing app's Node refresh API. Its published version therefore uses the bundled commercial snapshot and automatically presents the refresh control as unavailable. The server source remains here for local or future server-hosted deployment.
