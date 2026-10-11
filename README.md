# Gym aplikacija

Mobilna aplikacija za sledenje treningom (Capacitor + čisti JavaScript, brez ogrodja).
Koda je bila obnovljena iz nameščenega APK-ja (`com.gymapp.mobile`).

## Zasloni (`www/js/screens/`)
- **domov** – tedenski cilj, naslednji trening, današnji vnosi (teža, spanec, počutje), volumen
- **trening / novTrening** – seznam treningov in vnos novega treninga
- **predloge** – predloge treningov (Push, Pull, Noge …)
- **zdravje** – teža, spanec, počutje, energija
- **analitika** – grafi in statistika
- **nastavitve** – tema, velikost pisave, opomniki, izvoz/uvoz podatkov (JSON)
- **urediTrening** – urejanje že končanega treninga (klik na trening v zgodovini)
- **vaja** – statistika posamezne vaje z grafi (1RM, teža, volumen, ponovitve)

## Opomniki (`www/js/reminders.js`, `www/js/notifications.js`)
- Domov prikaže kartico **Za vpisati**: manjkajoč dnevni vpis, manjkajoč včerajšnji vpis,
  trening, ki še teče, in trening, ko zaostajaš za tedenskim ciljem.
- Trening je „nujen“, ko je preostalih treningov do tedenskega cilja toliko kot preostalih dni
  (ali več), sicer pa opomni, ko je od zadnjega treninga minilo preveč dni (cilj 4 → 3 dni).
- Na telefonu se za 7 dni vnaprej načrtujejo obvestila (07:30 tehtanje, 18:00 trening,
  21:00 dnevni vpis). Ob vsakem vpisu se načrt preračuna, zato že vpisani dnevi ne zvonijo.

Podatki se hranijo lokalno (`localStorage`, ključ `gymapp:v1`), glej `www/js/state.js`.

## Razvoj
```
npm install
npm run serve      # zgradi bundle in zažene v brskalniku
```

## Namestitev na telefon (GitHub Actions)
Ob vsakem pushu na `main` ali `claude/fitness-app-dev-foj4jp` GitHub Actions zgradi APK in ga objavi
kot Release. Na telefonu odpri
https://github.com/matic711/gym-app/releases/latest/download/gym-app.apk in namesti čez obstoječo aplikacijo
(ali v aplikaciji: Nastavitve → Posodobitve → Preveri). Podatki ostanejo, ker je vsak APK podpisan
z istim ključem iz secreta `ANDROID_KEYSTORE_BASE64` (base64 datoteke keystore, alias `androiddebugkey`,
gesli `android`). Ključ hrani na varnem — brez njega posodobitev brez izgube podatkov ni mogoča.

## Android (lokalno)
```
npm install
npx cap add android   # samo prvič
npm run android       # build + sync + odpre Android Studio
npm run phone         # build + namesti na priklopljen telefon (adb install -r, podatki ostanejo)
```

`adb install -r` ohrani podatke le, če je APK podpisan z istim ključem kot nameščena
aplikacija (debug ključ v `~/.android/debug.keystore` na računalniku, kjer se gradi).
Če se ključa ne ujemata, namestitev javi `INSTALL_FAILED_UPDATE_INCOMPATIBLE` in ničesar ne spremeni.
