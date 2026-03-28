# Get Running on iPhone in 5 Minutes

Your React Native Expo app is ready to test on your physical iPhone immediately.

## Prerequisites (2 minutes)
1. ✅ Node.js installed? Check with: `node -v` (needs v18+)
2. ✅ iPhone with Expo Go app? Download from App Store (search "Expo Go")
3. ✅ Backend running? Start with: `npm run dev` in main project folder
4. ✅ WiFi connection? Make sure iPhone is on same WiFi as your computer

## Run on iPhone (3 minutes)

### Step 1: Install dependencies (60 seconds)
```bash
cd /project\ 7/app-rn
npm install
# This downloads all required packages (~2 min first time)
```

### Step 2: Start Expo (30 seconds)
```bash
npm start
# Or: npx expo start
```

You should see terminal output with a **QR code**. Keep this terminal open!

```
 expo start
✔ Metro bundler started
 ✨ You can now open your app with Expo Go
 Scan this QR code:

 ┌────────────────────────────────────────┐
 │                                        │
 │                                        │  ← This QR code!
 │         [QR Code displays here]        │
 │                                        │
 │                                        │
 └────────────────────────────────────────┘
 
 › Connection: [LAN]
 IP address: 192.168.1.100
```

### Step 3: Open on iPhone (60 seconds)

**Option A: Using Camera (Recommended)**
1. Take your iPhone
2. Open the **Camera app**
3. Point at the **QR code** in terminal
4. Tap the notification that appears
5. Tap "Open in Expo Go"
6. **Done!** App loads on your iPhone

**Option B: Using Expo Go app**
1. Open **Expo Go app** on iPhone
2. Tap the **camera icon** at bottom
3. Scan the **QR code** from terminal
4. App loads automatically

## Test the App (Next)

Once app loads on iPhone:

### Test 1: Worker Sign Up (1 minute)
1. Tap **"Sign Up"** button
2. Enter:
   - Full Name: `John Delivery`
   - Email: `john@example.com`
   - Phone: `555-0123`
   - Password: `password123`
3. Tap **"Create Account"**
4. You're logged in! See dashboard with:
   - Green shift status button
   - Premium subscription info
   - Disruption alert card

### Test 2: Admin & Disruption (2 minutes)

**In web browser** (new tab):
1. Go to: `http://localhost:5173`
2. Tap **"Admin"** tab
3. Login: `admin@aasara.ai` / `admin123456`
4. Select your worker from dropdown
5. Choose a disruption type (monsoon, heatwave, etc.)
6. Tap **"Trigger Disruption"**

**On iPhone** (watch the Disruption Alert card):
- ⚡ Within 5 seconds, red alert appears!
- Shows disruption type
- Shows severity level
- Card updates automatically

## That's It! 🎉

Your React Native app is running on your real iPhone, connected to the backend, with live disruption alerts updating every 5 seconds.

## Troubleshooting

### App won't open from QR code
- ✅ Make sure Expo Go is **installed** on iPhone
- ✅ Check your iPhone is on **same WiFi** as computer
- ✅ Try the "Enter URL manually" option in Expo Go
- ✅ Restart the Expo app, then scan again

### API errors when signing up
- ✅ Verify backend is running: Press Ctrl+C to stop, then `npm run dev`
- ✅ Backend should show: `Server running on port 5001`
- ✅ Try accessing http://localhost:5001/api/health in browser

### QR code won't scan
- ✅ Make terminal window larger so QR code is clearer
- ✅ Try taking a photo from computer screen instead
- ✅ Or use "Enter URL manually" in Expo Go app

### App is slow / crashes
- ✅ Press `r` in terminal to reload the app
- ✅ Close and reopen Expo Go app on iPhone
- ✅ Restart Metro with: `npm start -- --reset-cache`

## Next Steps

Once you've verified it works:

1. **Make changes** to any file in `/app-rn/`
2. **Save the file** → hot reload happens automatically (usually)
3. **See changes on iPhone** in seconds!

To modify styles/layout:
- Edit `.tsx` files in `app/screens/` folder
- Change colors in `StyleSheet` at bottom of each file

## Still Need Help?

- ✅ Read README.md for complete documentation
- ✅ Read SETUP.md for detailed setup guide
- ✅ Check Expo docs: https://docs.expo.dev

## What You Have Now

✅ **React web** running on http://localhost:5173  
✅ **React Native** running on your iPhone via Expo Go  
✅ **Flutter app** ready in /aasara_flutter  
✅ **Same backend** serving all three platforms  

Multiple platforms, one backend. Test on device in minutes! 🚀
