# REST for the Wicked

1. Apply `patches/firefox.patch` to firefox source
2. Install node packages with `$ npm i`
3. Build RTFW `$ npm run build` (It will ask for sudo to setuid some tools)
4. Start the server `$ npm run start`
5. Inside this directory run the following command: `$ ~/path/to/mach run http://localhost:8080/attack-pixels.htm | tee output.txt`