"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Systemet fungerer som forventet.",
  "Ingen feil registrert. Det er mistenkelig.",
  "Lageret er strukturert. Foreløpig.",
  "Plukk er ikke aktivert. Det er sikkert greit.",
  "Data er konsistent. For nå.",
  "Avvik eksisterer. De bare vises ikke enda.",
  "Alt er riktig. Inntil noen sjekker.",
  "Systemet overvåker. Ikke omvendt.",
  "Ingen kritiske avvik registrert. Foreløpig.",
"Lagerdata vurderes som tilstrekkelig ryddig.",
"Systemstatus: Stabil, men ikke overmodig.",
"Plukkemodul avventer modenhet.",
"Lokasjonsstruktur under kontroll. Nesten.",
"Ingen bærer tirsdagen helt likt.",
    "Det hjelper å stå litt skrått i store rom.",
    "Ingen blir lettere av å stå for nær en fruktskål.",
    "Det finnes morgener som kun svarer til glass.",
    "Et vennlig hjørne kan ikke oppholde seg i trekk.",
    "Noen beslutninger må tørkes flatt.",
    "Det er ikke alle vinduer som fortjener utsikt.",
    "Du ble ikke sendt hit for å forstå lampen.",
    "Onsdag er mykere fra undersiden.",
    "Stille kopper gjør sjelden et nummer ut av seg.",
    "Det er best å møte enkelte formiddager uten for mye møbel.",
    "Små gjennombrudd kommer ofte uten korrekt fottøy.",
    "Ikke alle dørkarmer ønsker deg jevnt fremover.",
    "Det er noe med gardiner som vet for mye.",
    "Noen skritt blir bedre av å ikke ha så tydelig gulv.",
    "Det er vanskelig å bevare verdighet ved siden av en stresset appelsin.",
    "Ikke alt lys er ment for skuldre.",
    "Store rom krever ofte lavere indre møblering.",
    "Visse stoler godkjenner deg først når du reiser deg.",
    "Morgenen tåler best lave skuldre og høy frukt.",
    "Ikke alle trapper er enige i oppover.",
    "Noen bordflater bør behandles som midlertidig himmel.",
    "Det er klokt å la enkelte lamper mene sitt i fred.",
    "Ingen får full klarhet i nærheten av en overmoden banan.",
    "Det finnes skygger som bare oppstår for å korrigere holdning.",
    "Ikke alle tekopper er komfortable med sannheten.",
    "Noen gardiner åpner seg med for mye selvtillit.",
    "Du bør ikke undervurdere hva et lite bord kan få til på en rolig dag.",
    "Det er sjelden riktig å møte en stor vase med for mye tydelighet.",
    "Ikke alle frukter ønsker å bidra til helheten.",
    "En korridor kan være mer personlig enn den gir inntrykk av.",
    "Det er best å holde en viss avstand til bestemte typer mykt dagslys.",
    "Ingen blir helt seg selv foran et uforberedt speil.",
    "Noen tepper legger føringer uten å si fra.",
    "Ikke alle puter er laget for moralsk støtte.",
    "Det finnes tallerkener som gjør deg mer observant enn nødvendig.",
    "Smale rom tåler dårlig store indre bevegelser.",
    "Det er ikke sikkert lampeskjermen vil deg vel, bare fordi tonen er varm.",
    "Noen vinduskarmer har en unødvendig sterk mening om tempo.",
    "Det er utfordrende å bevare oversikt i nærheten av en meget moden pære.",
    "Ikke alle små skjeer er til å stole på i direkte morgenlys.",
    "Det finnes formiddager som blir for store hvis man setter seg for rett.",
    "Noen blomsterbord ønsker bare å se hvordan du håndterer press.",
    "Ikke alle glassflater er modne for kontakt før klokken elleve.",
    "Det er noe ved lave hyller som får dagen til å trekke seg sammen.",
    "En vennlig stol kan fortsatt være feil stol.",
    "Noen skygger bør få jobbe uforstyrret.",
    "Ikke alt som står i vinduet trenger å bli forstått.",
    "Visse rom foretrekker at du er litt mindre bestemt.",
    "Det er vanskelig å være prinsipiell ved siden av en melon med tyngde.",
    "Dagen behandles fortløpende der det lar seg gjøre.",
    "Lette gjennombrudd meldes etter behov.",
    "Lokale glimt av mening kan ikke utelukkes.",
    "Indre klarvær forekommer i utsatte områder.",
    "Uavklart lettelse er observert langs myke overflater.",
    "Det meldes om rolige forhold med fare for innsikt.",
    "Midlertidig ro er innvilget uten nærmere begrunnelse.",
    "Dagens lysnivå er tilstrekkelig for stille justeringer.",
    "Mild oppdrift kan forekomme nær gardiner og åpne tanker.",
    "Unødig tyngde settes på vent til ny vurdering.",
    "Deler av formiddagen er nå administrativt godkjent.",
    "Spredt avklaring ventes i høyden og ved enkelte kaffekopper.",
    "Lokal bedring i retning observeres uten krav til forklaring.",
    "Stille forhold med innslag av ubegrunnet fremdrift forventes.",
    "Midlertidig mykhet er nå virksom i relevante soner.",
    "Varsel om lett indre oppklaring er sendt uten vedlegg.",
    "Dagen står foreløpig inne for deler av seg selv.",
    "Forholdene ligger til rette for begrenset, men lovlig håp.",
    "Det åpnes for mindre justeringer i personlig tyngdepunkt.",
    "Rolige skift i betydning kan forekomme utover ettermiddagen.",
    "Spredt lettelse er meldt i indre strøk.",
    "Det foreligger nå grunnlag for moderat oppdrift.",
    "Videre ro håndteres lokalt.",
    "Myk avklaring er registrert i flere stille felt.",
    "Deler av dagen vil opptre mer samarbeidsvillig enn først antatt.",
    "Det varsles små forbedringer i personlige himmelforhold.",
    "En viss lysmessig oppmykning er nå i omløp.",
    "Tyngre indre forhold ventes å lette i skjermede områder.",
    "Begrenset, men reell avlastning meldes ved vindusnære soner.",
    "Det er åpnet for moderat mening uten vedtak.",
    "Lette forskyvninger i personlig værtype er nå sannsynlige.",
    "Mild administrativ sol er innført med umiddelbar virkning.",
    "Indre forhold vurderes som håndterbare under rolige overflater.",
    "Videre klarhet kan ikke påregnes, men den er heller ikke avvist.",
    "Det rapporteres om ryddigere forhold i deler av den indre bebyggelsen.",
    "Midlertidig orden er innført der forholdene tillater det.",
    "Det meldes om svak, men stabil bedring i følelsesnær struktur.",
    "Personlig lettelse kan oppstå uten forvarsel i relevante rom.",
    "Det er grunn til å senke skuldrene innenfor rimelighetens grenser.",
    "Visse soner er nå åpnet for stillferdig fremgang.",
    "Ytre forhold er uendret. Indre forhold viser tegn til saksbehandling.",
    "Dagen framstår mer medgjørlig enn dokumentasjonen tilsier.",
    "Det er registrert ro i systemet, om enn uten varighet.",
    "Mindre glimt av oversikt er nå tillatt.",
    "Det foreligger adgang til myk bevegelse i utvalgte tankefelt.",
    "Deler av ettermiddagen vil kunne opptre med lavere motstand.",
    "Det åpnes for udramatisk fremdrift under en viss høflighet.",
    "Indre oppholdsvær meldes i soner som tidligere var vanskelig tilgjengelige.",
    "Lette tegn til mening er innrapportert, men ikke bekreftet.",
    "Dagen håndteres videre som et samarbeid mellom lys og tilfeldighet.",
    
];

export default function SnakeFooter() {
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");

 useEffect(() => {
  const updateTime = () => {
    const now = new Date();

    const formatted = now.toLocaleString("no-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    setTime(formatted);
  };

const updateMessage = () => {
  const now = new Date();
  const index = Math.floor(now.getTime() / 60000) % MESSAGES.length;
  setMessage(MESSAGES[index]);
};

  updateTime();
  updateMessage();

  const interval = setInterval(() => {
    updateTime();
    updateMessage();
  }, 60000);

  return () => clearInterval(interval);
}, []);

  return (
    <footer className="mt-6 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/[0.15] px-6 py-4 text-sm text-white/50 backdrop-blur">
      
      <div className="font-medium">
        {time}
      </div>

      <div className="hidden md:block text-white/40">
        {message}
      </div>

      <div className="uppercase tracking-[0.2em] text-white/35">
        Snake VKLS BY JENSEN DIGITAL
      </div>
    </footer>
  );
}