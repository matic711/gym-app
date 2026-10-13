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

## Predlogi teže – double progression (`www/js/progression.js`)
Za vsako vajo pogleda zadnji trening te vaje (delovne serije = serije z najvišjo težo):
- vse serije na vrhu razpona → +korak teže, cilj spodnja meja ponovitev,
- sicer ista teža in +1 ponovitev (pod spodnjo mejo: cilj spodnja meja),
- dvakrat zapored pod razponom pri isti teži → −10 % (deload),
- slab jutranji vpis (spanec < 6 h, kakovost 1/5 ali stres ≥ 8) → namesto dviga „drži težo“.
- lažji trening (delovna teža ≥ 5 % pod prejšnjim treningom) se preskoči in predlog izhaja iz
  zadnjega normalnega; dvakrat zapored lažje (ali deload, ki ga je predlagala aplikacija) je nova raven.

Privzeto: compound 6–8 pon. (noge +5 kg, ostalo +2,5 kg), izolacija in kabli 10–15 pon. +2,5 kg,
lastna teža 6–12 pon. nato +2,5 kg uteži; core/kardio brez predlogov. Za vsako vajo se nastavi
na zaslonu vaje (Napredovanje). Med treningom ✓ na prazni seriji prevzame predlagane vrednosti.

## Analitika (zaslon `analitika`)
Obdobje velja za ves zaslon: Teden in Mesec sta koledarska (kot poročila), 3 mes./Leto/Vse se končajo danes.
Obdobje v teku se primerja z enakim številom dni prejšnjega. Kartice: Moč (sprememba glede na prej
in glede na telesno težo, graf, najtežji dvigi), Trening (volumen po dnevih/tednih/mesecih), Rekordi v obdobju,
Teža, Spanec (4–10 h, cilj 7 h), Počutje (lestvica 1–5, energija, stres), Statistika po vajah.

## Poročila (`www/js/reports.js`, zaslon `porocilo`)
Kratek pregled z besedami (ne ponavlja grafov): treningi glede na cilj, uvrstitev po volumnu, novi rekordi
ali najtežji dvig, napredek, povprečen spanec/stres/teža, rednost vpisov, platoji in fokus za naprej.
Gumb Deli (besedilo), „Podrobno“ odpre Analitiko. Obvestilo v nedeljo 19:00 in zadnji dan v mesecu 19:00,
na Domov kartica, dokler ga ne odpreš; arhiv za nazaj s puščicami.

## Platoji (`www/js/plateau.js`)
Vaja je na platoju, če se je v zadnjih 21 dneh še delala, a od zadnjega napredka (večja delovna teža
ali več ponovitev pri najboljši teži) minejo vsaj N tednov (privzeto 4) in vsaj 4 treningi.
Če je telesna teža v tem času padla za 2 % ali več, je označeno kot cut (moč drži). Predlogi: spanec/stres,
deload, sprememba razpona, dodatna serija, varianta vaje.

## Prehrana (neobvezno, `www/js/nutrition.js`, zaslon `prehrana`)
Vklopi se v Nastavitve → Prehrana; izklopljena je povsod skrita (podatki ostanejo). Dnevni vnos po obrokih,
kalorije in makrohranila glede na cilje (ročno ali „Predlagaj cilje“ iz telesne teže). Izdelki:
iskanje v bazi Open Food Facts, skeniranje črtne kode (Google ML Kit skener, `www/js/scanner.js`,
brez dovoljenja za kamero), lastni izdelki s črtno kodo, ki jih skener potem najde. Uporabljeni izdelki
iz baze se shranijo lokalno za uporabo brez povezave. Povzetek na Domov, v koledarju in poročilih.

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
