# Gym aplikacija

Mobilna aplikacija za sledenje treningom (Capacitor + čisti JavaScript, brez ogrodja).
Koda je bila obnovljena iz nameščenega APK-ja (`com.gymapp.mobile`).

## Zasloni (`www/js/screens/`)
- **domov** – tedenski cilj, naslednji trening, današnji vnosi (teža, spanec, počutje), volumen
- **trening / novTrening** – seznam treningov in vnos novega treninga
- **predloge** – predloge treningov (Push, Pull, Noge …)
- **zdravje** – teža, spanec, počutje, energija
- **analitika** – grafi in statistika
- **nastavitve** – tema, velikost pisave, izvoz/uvoz podatkov (JSON)

Podatki se hranijo lokalno (`localStorage`, ključ `gymapp:v1`), glej `www/js/state.js`.

## Razvoj
```
npm install
npm run serve      # zgradi bundle in zažene v brskalniku
```

## Android
```
npm install
npx cap add android   # samo prvič
npm run android       # build + sync + odpre Android Studio
```
