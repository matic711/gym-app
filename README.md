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
- **vaja** – statistika posamezne vaje z grafi (najtežji dvig, volumen, ponovitve)
- **koledar** – mesečni pregled (treningi, vpisi počutja); klik na dan pokaže počutje in treninge tistega dne
- **forma** – analiza: kako spanec, stres, energija in teža vplivajo na lifte; opozorilo, ko nazaduješ

Imena vaj so v angleščini (knjižnica v `exercises.js`). Starejši podatki s slovenskimi imeni se ob
prvem zagonu enkrat preimenujejo (`SL_TO_EN`), iskanje vaj pa razume tudi slovenske besede.

## Jutranji vpis
Dokler današnji dan ni vpisan (od 4:00 naprej), aplikacija pokaže samo zaslon „Dobro jutro“
(izklopiš v Nastavitve → Opomniki → Zakleni aplikacijo do vpisa). Obvestilo pride ob nastavljeni uri
in se ponavlja (+1 h, +2 h, +3 h, +5 h, +9 h, 21:00), dokler dan ni vpisan.

## Analiza forme (`www/js/analysis.js`)
- Vsako vajo na treningu primerja z mediano zadnjih (do 6) treningov iste vaje → forma v %.
  Serije z različnim številom ponovitev preračuna na primerljivo moč (Epley), prikaže pa samo %.
- Trend: zadnji 4 tedni proti prejšnjim 4 — moč, moč na kg telesne teže, teža, volumen,
  treningi na teden, rednost vpisov. „Nazaduješ“ pomeni padec moči glede na telesno težo za 3 % ali več;
  če moč pada samo sorazmerno s težo (cut), je to označeno kot pričakovano.
- Vplivi: treningi se razdelijo na polovico z višjo in nižjo vrednostjo dejavnika (spanec, stres …)
  in primerja se povprečna forma. Potrebnih je vsaj 8 treningov z vpisom tistega dne.

## Opomniki (`www/js/reminders.js`, `www/js/notifications.js`)
- Domov prikaže kartico **Za vpisati**: manjkajoč dnevni vpis, manjkajoč včerajšnji vpis,
  trening, ki še teče, in trening, ko zaostajaš za tedenskim ciljem.
- Trening je „nujen“, ko je preostalih treningov do tedenskega cilja toliko kot preostalih dni
  (ali več), sicer pa opomni, ko je od zadnjega treninga minilo preveč dni (cilj 4 → 3 dni).
- Na telefonu se za 7 dni vnaprej načrtujejo obvestila (jutranji vpis s ponavljanjem, 18:00 trening).
  Ob vsakem vpisu se načrt preračuna, zato že vpisani dnevi ne zvonijo.

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
